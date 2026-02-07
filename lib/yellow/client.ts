/**
 * Yellow Network Client
 *
 * Wrapper around yellow-ts SDK with connection management,
 * authentication, and event handling for prediction markets.
 */

import { Client } from 'yellow-ts';
import {
  RPCMethod,
  RPCResponse,
  createAuthRequestMessage,
  createAuthVerifyMessage,
  createEIP712AuthMessageSigner,
  createGetLedgerBalancesMessage,
  createGetSessionKeysMessage,
  createECDSAMessageSigner,
  createAppSessionMessage,
  createSubmitAppStateMessage,
  createCloseAppSessionMessage,
  createGetAppSessionsMessage,
  createGetAppDefinitionMessage,
  createTransferMessage,
  RPCAppStateIntent,
  RPCProtocolVersion,
} from '@erc7824/nitrolite';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import type { Address, Hex } from 'viem';
import type {
  YellowClientConfig,
  YellowClientState,
  UnifiedBalance,
  Listener,
  SessionKeyConfig,
  ActiveSessionKey,
  AppSessionRequest,
  AppSessionResponse,
  Allocation,
} from './types';
import { ConnectionStatus } from './types';
import { YELLOW_CONFIG } from './config';

export class YellowClient {
  private client: Client;
  private state: YellowClientState;
  private listeners: Map<string, Set<Listener>>;

  // Authentication
  private mainAddress?: `0x${string}`;
  private mainWalletSigner?: any; // EIP-712 signer for main wallet
  private sessionPrivateKey?: `0x${string}`;
  private sessionSigner?: any; // ECDSA signer for session key
  private sessionAddress?: `0x${string}`;
  private jwtToken?: string;

  constructor(config: YellowClientConfig = {}) {
    const wsUrl = config.wsUrl || YELLOW_CONFIG.CLEARNODE_WS_URL;

    this.client = new Client({ url: wsUrl });
    this.state = { status: ConnectionStatus.DISCONNECTED };
    this.listeners = new Map();

    // Setup message listener
    this.client.listen(this.handleMessage.bind(this));
  }

  // ============================================================================
  // Connection Management
  // ============================================================================

  async connect(): Promise<void> {
    try {
      this.updateState({ status: ConnectionStatus.CONNECTING });
      await this.client.connect();
      this.updateState({ status: ConnectionStatus.CONNECTED });
      console.log('✅ Connected to Yellow Network ClearNode');
    } catch (error) {
      console.error('Failed to connect to Yellow Network:', error);
      this.updateState({
        status: ConnectionStatus.ERROR,
        error: error instanceof Error ? error.message : 'Connection failed',
      });
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      await this.client.disconnect();
      this.updateState({ status: ConnectionStatus.DISCONNECTED });
      console.log('✅ Disconnected from Yellow Network');
    } catch (error) {
      console.error('Error disconnecting:', error);
      throw error;
    }
  }

  isConnected(): boolean {
    return (
      this.state.status === ConnectionStatus.CONNECTED ||
      this.state.status === ConnectionStatus.AUTHENTICATED
    );
  }

  isAuthenticated(): boolean {
    return this.state.status === ConnectionStatus.AUTHENTICATED;
  }

  getState(): YellowClientState {
    return { ...this.state };
  }

  // ============================================================================
  // Authentication
  // ============================================================================

  /**
   * Authenticate with Yellow Network using EIP-712 signatures
   * Creates a session key for gasless operations
   */
  async authenticate(
    walletAddress: `0x${string}`,
    walletSigner: any // Should be from wagmi/viem
  ): Promise<void> {
    try {
      if (!this.isConnected()) {
        throw new Error('Not connected to Yellow Network');
      }

      console.log('🔐 Starting authentication...');

      // Store main wallet info
      this.mainAddress = walletAddress;
      this.mainWalletSigner = walletSigner;

      // Generate session key
      this.sessionPrivateKey = generatePrivateKey();
      this.sessionSigner = createECDSAMessageSigner(this.sessionPrivateKey);
      const sessionAccount = privateKeyToAccount(this.sessionPrivateKey);
      this.sessionAddress = sessionAccount.address;

      console.log('📝 Session key generated:', this.sessionAddress);

      // Create session key configuration
      const allowances: Array<{ asset: string; amount: string }> = [...YELLOW_CONFIG.DEFAULT_ALLOWANCES];
      const expiresAt = Math.floor(Date.now() / 1000) + YELLOW_CONFIG.SESSION_KEY_EXPIRY;

      // Step 1: Send auth_request
      const authRequestMsg = await createAuthRequestMessage({
        address: this.mainAddress,
        session_key: this.sessionAddress,
        application: YELLOW_CONFIG.APPLICATION_NAME,
        allowances,
        scope: YELLOW_CONFIG.SESSION_KEY_SCOPE,
        expires_at: BigInt(expiresAt),
      });

      await this.client.sendMessage(authRequestMsg);
      console.log('📤 Sent auth_request');

      // Step 2: Wait for auth_challenge
      // This is handled in handleMessage() which will call handleAuthChallenge()
    } catch (error) {
      console.error('Authentication failed:', error);
      this.updateState({
        status: ConnectionStatus.ERROR,
        error: error instanceof Error ? error.message : 'Authentication failed',
      });
      throw error;
    }
  }

  private async handleAuthChallenge(message: RPCResponse): Promise<void> {
    try {
      if (!this.mainWalletSigner || !this.mainAddress) {
        throw new Error('Main wallet not initialized');
      }

      console.log('🔑 Received auth_challenge');

      // Extract challenge from response
      const challenge = (message.params as any).challenge_message;

      // Sign challenge with main wallet using EIP-712
      const expiresAt = Math.floor(Date.now() / 1000) + YELLOW_CONFIG.SESSION_KEY_EXPIRY;
      const authParamsForSigner = {
        scope: YELLOW_CONFIG.SESSION_KEY_SCOPE,
        application: YELLOW_CONFIG.APPLICATION_NAME,
        participant: this.sessionAddress!,
        session_key: this.sessionAddress!,
        expires_at: BigInt(expiresAt),
        allowances: [...YELLOW_CONFIG.DEFAULT_ALLOWANCES] as Array<{ asset: string; amount: string }>,
      };

      const eip712Signer = createEIP712AuthMessageSigner(
        this.mainWalletSigner,
        authParamsForSigner as any, // Type casting as the nitrolite types may not be fully accurate
        { name: YELLOW_CONFIG.APPLICATION_NAME }
      );

      // Create and send auth_verify
      const authVerifyMsg = await createAuthVerifyMessage(eip712Signer, challenge);
      await this.client.sendMessage(authVerifyMsg);

      console.log('📤 Sent auth_verify');
    } catch (error) {
      console.error('Failed to handle auth challenge:', error);
      throw error;
    }
  }

  private async handleAuthVerify(message: RPCResponse): Promise<void> {
    try {
      console.log('✅ Authentication successful!');

      // Extract JWT token from response (if provided)
      const params = message.params as any;
      if (params?.token) {
        this.jwtToken = params.token;
      }

      this.updateState({
        status: ConnectionStatus.AUTHENTICATED,
        address: this.mainAddress,
        sessionKey: this.sessionAddress,
      });

      // Fetch initial unified balance
      await this.fetchUnifiedBalance();
    } catch (error) {
      console.error('Failed to complete authentication:', error);
      throw error;
    }
  }

  // ============================================================================
  // Unified Balance
  // ============================================================================

  async fetchUnifiedBalance(): Promise<UnifiedBalance> {
    try {
      if (!this.isAuthenticated() || !this.sessionSigner || !this.mainAddress) {
        throw new Error('Not authenticated');
      }

      const balanceMsg = await createGetLedgerBalancesMessage(
        this.sessionSigner,
        this.mainAddress
      );

      const response = await this.client.sendMessage(balanceMsg);

      const balances = (response as any).res?.[2] || [];
      const unifiedBalance: UnifiedBalance = {
        balances,
        updated_at: new Date().toISOString(),
      };

      this.updateState({ unifiedBalance });
      return unifiedBalance;
    } catch (error) {
      console.error('Failed to fetch unified balance:', error);
      throw error;
    }
  }

  getUnifiedBalance(): UnifiedBalance | undefined {
    return this.state.unifiedBalance;
  }

  // ============================================================================
  // Session Keys Management
  // ============================================================================

  async getSessionKeys(): Promise<ActiveSessionKey[]> {
    try {
      if (!this.isAuthenticated() || !this.sessionSigner) {
        throw new Error('Not authenticated');
      }

      const msg = await createGetSessionKeysMessage(this.sessionSigner);
      const response = await this.client.sendMessage(msg);

      const sessionKeys = (response as any).res?.[2]?.session_keys || [];
      return sessionKeys;
    } catch (error) {
      console.error('Failed to fetch session keys:', error);
      throw error;
    }
  }

  // ============================================================================
  // Message Handling
  // ============================================================================

  private async handleMessage(message: RPCResponse): Promise<void> {
    try {
      switch (message.method) {
        case RPCMethod.AuthChallenge:
          await this.handleAuthChallenge(message);
          break;

        case RPCMethod.AuthVerify:
          await this.handleAuthVerify(message);
          break;

        case RPCMethod.BalanceUpdate:
          console.log('💰 Balance update:', message.params);
          await this.fetchUnifiedBalance();
          this.emit('balance_update', message);
          break;

        case RPCMethod.Error:
          console.error('❌ Yellow Network error:', message.params);
          this.emit('error', message);
          break;

        default:
          // Emit to any registered listeners
          this.emit(message.method, message);
          break;
      }
    } catch (error) {
      console.error('Error handling message:', error);
    }
  }

  // ============================================================================
  // Event Emitter
  // ============================================================================

  on(event: string, listener: Listener): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);

    // Return unsubscribe function
    return () => {
      this.listeners.get(event)?.delete(listener);
    };
  }

  private emit(event: string, data: any): void {
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.forEach((listener) => {
        try {
          listener(data);
        } catch (error) {
          console.error(`Error in listener for ${event}:`, error);
        }
      });
    }
  }

  private updateState(updates: Partial<YellowClientState>): void {
    this.state = { ...this.state, ...updates };
    this.emit('state_change', this.state);
  }

  // ============================================================================
  // Raw Client Access
  // ============================================================================

  getRawClient(): Client {
    return this.client;
  }

  getSessionSigner() {
    return this.sessionSigner;
  }

  getMainAddress(): `0x${string}` | undefined {
    return this.mainAddress;
  }

  // ============================================================================
  // Deposit & Withdrawal
  // ============================================================================

  /**
   * Deposit funds from wallet to Unified Balance (via Transfer)
   */
  async depositToUnifiedBalance(asset: string, amount: string): Promise<void> {
    try {
      if (!this.isAuthenticated() || !this.sessionSigner) {
        throw new Error('Not authenticated');
      }

      console.log(`💰 Depositing ${amount} ${asset} to Unified Balance...`);

      const transferMsg = await createTransferMessage(this.sessionSigner, {
        allocations: [{ asset, amount }],
      });

      await this.client.sendMessage(transferMsg);
      console.log('✅ Deposit initiated');

      // Refresh balance after deposit
      await this.fetchUnifiedBalance();
    } catch (error) {
      console.error('Failed to deposit:', error);
      throw error;
    }
  }

  /**
   * Withdraw funds from Unified Balance to wallet
   */
  async withdrawFromUnifiedBalance(
    asset: string,
    amount: string,
    destination: Address
  ): Promise<void> {
    try {
      if (!this.isAuthenticated() || !this.sessionSigner) {
        throw new Error('Not authenticated');
      }

      console.log(`💸 Withdrawing ${amount} ${asset} to ${destination}...`);

      const transferMsg = await createTransferMessage(this.sessionSigner, {
        destination,
        allocations: [{ asset, amount }],
      });

      await this.client.sendMessage(transferMsg);
      console.log('✅ Withdrawal initiated');

      // Refresh balance after withdrawal
      await this.fetchUnifiedBalance();
    } catch (error) {
      console.error('Failed to withdraw:', error);
      throw error;
    }
  }

  // ============================================================================
  // App Sessions (Prediction Markets)
  // ============================================================================

  /**
   * Create an App Session for a prediction market
   * Returns the app_session_id
   */
  async createAppSession(request: AppSessionRequest): Promise<string> {
    try {
      if (!this.isAuthenticated() || !this.sessionSigner) {
        throw new Error('Not authenticated');
      }

      console.log('🎲 Creating App Session for market...');

      // Create request with application field
      const rpcRequest = {
        ...request,
        definition: {
          ...request.definition,
          application: YELLOW_CONFIG.APPLICATION_NAME,
        },
      };

      const message = await createAppSessionMessage(this.sessionSigner, rpcRequest as any);
      const response = await this.client.sendMessage(message);

      // Parse response to extract app_session_id
      const result = (response as any).res?.[2]?.[0];
      if (!result?.app_session_id) {
        throw new Error('Failed to create app session - no session ID returned');
      }

      console.log('✅ App Session created:', result.app_session_id);
      return result.app_session_id;
    } catch (error) {
      console.error('Failed to create app session:', error);
      throw error;
    }
  }

  /**
   * Submit bet to App Session using DEPOSIT intent
   */
  async submitBet(
    appSessionId: Hex,
    poolAddress: Address,
    asset: string,
    amount: string,
    currentAllocations: Allocation[]
  ): Promise<void> {
    try {
      if (!this.isAuthenticated() || !this.sessionSigner) {
        throw new Error('Not authenticated');
      }

      console.log(`🎯 Submitting bet: ${amount} ${asset} to ${poolAddress}...`);

      // Update allocations with new bet
      const newAllocations = currentAllocations.map((alloc) =>
        alloc.participant === poolAddress
          ? {
              ...alloc,
              amount: (BigInt(alloc.amount) + BigInt(amount)).toString(),
            }
          : alloc
      );

      const message = await createSubmitAppStateMessage(this.sessionSigner, {
        app_session_id: appSessionId,
        intent: RPCAppStateIntent.Deposit,
        version: 1,
        allocations: newAllocations as any, // Type cast since our Allocation type uses string for participant
      });

      await this.client.sendMessage(message);
      console.log('✅ Bet submitted successfully');
    } catch (error) {
      console.error('Failed to submit bet:', error);
      throw error;
    }
  }

  /**
   * Get App Session definition (to read current allocations)
   */
  async getAppDefinition(appSessionId: Hex): Promise<any> {
    try {
      if (!this.isAuthenticated() || !this.sessionSigner) {
        throw new Error('Not authenticated');
      }

      const message = await createGetAppDefinitionMessage(
        this.sessionSigner,
        appSessionId
      );
      const response = await this.client.sendMessage(message);

      return (response as any).res?.[2];
    } catch (error) {
      console.error('Failed to get app definition:', error);
      throw error;
    }
  }

  /**
   * Get all App Sessions for a participant
   */
  async getAppSessions(
    participant: Address,
    status?: 'open' | 'closed'
  ): Promise<any[]> {
    try {
      if (!this.isAuthenticated() || !this.sessionSigner) {
        throw new Error('Not authenticated');
      }

      const message = await createGetAppSessionsMessage(
        this.sessionSigner,
        participant,
        status as any // Type cast for channel status
      );
      const response = await this.client.sendMessage(message);

      return (response as any).res?.[2] || [];
    } catch (error) {
      console.error('Failed to get app sessions:', error);
      throw error;
    }
  }

  /**
   * Close App Session and distribute funds (called by oracle)
   */
  async closeAppSession(
    appSessionId: Hex,
    finalAllocations: Allocation[]
  ): Promise<void> {
    try {
      if (!this.isAuthenticated() || !this.sessionSigner) {
        throw new Error('Not authenticated');
      }

      console.log('🏁 Closing App Session:', appSessionId);

      const message = await createCloseAppSessionMessage(this.sessionSigner, {
        app_session_id: appSessionId,
        allocations: finalAllocations as any, // Type cast since our Allocation type uses string for participant
      });

      await this.client.sendMessage(message);
      console.log('✅ App Session closed successfully');
    } catch (error) {
      console.error('Failed to close app session:', error);
      throw error;
    }
  }

  /**
   * Calculate market odds from App Session allocations
   */
  calculateOdds(allocations: Allocation[]): {
    yesPrice: number;
    noPrice: number;
  } {
    const yesAmount = BigInt(allocations[0]?.amount || '0');
    const noAmount = BigInt(allocations[1]?.amount || '0');
    const total = yesAmount + noAmount;

    if (total === BigInt(0)) {
      return { yesPrice: 50, noPrice: 50 };
    }

    const yesPrice = (Number(yesAmount) / Number(total)) * 100;
    const noPrice = (Number(noAmount) / Number(total)) * 100;

    return { yesPrice, noPrice };
  }
}
