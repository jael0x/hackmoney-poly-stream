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
  RPCAppStateIntent,
} from '@erc7824/nitrolite';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { createWalletClient, http } from 'viem';
import type { Address, Hex } from 'viem';
import type {
  YellowClientConfig,
  YellowClientState,
  UnifiedBalance,
  Listener,
  ActiveSessionKey,
  AppSessionRequest,
  Allocation,
} from './types';
import { ConnectionStatus } from './types';
import { YELLOW_CONFIG } from './config';

export { ConnectionStatus } from './types';

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
  private authResolve?: (value: void) => void;
  private authReject?: (reason?: any) => void;

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
    const isAuth = this.state.status === ConnectionStatus.AUTHENTICATED;
    const hasSigner = !!this.sessionSigner;

    if (isAuth && !hasSigner) {
      console.error('⚠️ WARNING: Authenticated but no session signer!');
    }

    return isAuth && hasSigner;
  }

  getState(): YellowClientState {
    return { ...this.state };
  }

  // ============================================================================
  // Authentication
  // ============================================================================

  /**
   * Authenticate with a private key (for server-side operations)
   */
  async authenticateWithPrivateKey(privateKey: Hex): Promise<void> {
    const account = privateKeyToAccount(privateKey);
    const walletClient = createWalletClient({
      account,
      chain: {
        id: 1,
        name: 'Ethereum',
        network: 'ethereum',
        nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
        rpcUrls: { default: { http: ['https://eth.llamarpc.com'] }, public: { http: ['https://eth.llamarpc.com'] } },
      },
      transport: http(),
    });

    return this.authenticate(account.address, walletClient);
  }

  /**
   * Authenticate with Yellow Network using EIP-712 signatures
   * Creates a session key for gasless operations
   */
  async authenticate(
    walletAddress: `0x${string}`,
    walletSigner: any // Should be from wagmi/viem
  ): Promise<void> {
    return new Promise(async (resolve, reject) => {
      // Add authentication timeout
      const authTimeout = setTimeout(() => {
        console.error('❌ Authentication timeout - no auth_verify response received');
        this.authResolve = undefined;
        this.authReject = undefined;
        this.updateState({
          status: ConnectionStatus.ERROR,
          error: 'Authentication timeout - server did not respond with auth_verify',
        });
        reject(new Error('Authentication timeout after 30 seconds'));
      }, 30000); // 30 second timeout

      try {
        if (!this.isConnected()) {
          clearTimeout(authTimeout);
          throw new Error('Not connected to Yellow Network');
        }

        console.log('🔐 Starting authentication...');

        // Store promise handlers with timeout cleanup
        const originalResolve = resolve;
        const originalReject = reject;

        this.authResolve = () => {
          clearTimeout(authTimeout);
          originalResolve();
        };
        this.authReject = (error: Error) => {
          clearTimeout(authTimeout);
          originalReject(error);
        };

        // Store main wallet info
        this.mainAddress = walletAddress;
        this.mainWalletSigner = walletSigner;

        // Generate session key
        this.sessionPrivateKey = generatePrivateKey();
        console.log('🔑 Generated session private key');

        // Create ECDSA signer for the session key
        this.sessionSigner = createECDSAMessageSigner(this.sessionPrivateKey);
        console.log('✅ Created ECDSA message signer');

        const sessionAccount = privateKeyToAccount(this.sessionPrivateKey);
        this.sessionAddress = sessionAccount.address;

        console.log('📝 Session key generated:', this.sessionAddress);
        console.log('  - Session signer ready:', !!this.sessionSigner);

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

        // Parse if it's a string (like in working implementation)
        const msgToSend = typeof authRequestMsg === 'string'
          ? JSON.parse(authRequestMsg)
          : authRequestMsg;

        await this.client.sendMessage(msgToSend);
        console.log('📤 Sent auth_request');

        // Step 2: Wait for auth_challenge
        // This is handled in handleMessage() which will call handleAuthChallenge()
      } catch (error) {
        clearTimeout(authTimeout); // Clear timeout on error
        console.error('Authentication failed:', error);
        this.updateState({
          status: ConnectionStatus.ERROR,
          error: error instanceof Error ? error.message : 'Authentication failed',
        });
        this.authReject = undefined;
        this.authResolve = undefined;
        reject(error);
      }
    });
  }

  private async handleAuthChallenge(message: RPCResponse): Promise<void> {
    try {
      if (!this.mainWalletSigner || !this.mainAddress) {
        throw new Error('Main wallet not initialized');
      }

      console.log('🔑 Received auth_challenge');

      // Sign challenge with main wallet using EIP-712
      const expiresAt = Math.floor(Date.now() / 1000) + YELLOW_CONFIG.SESSION_KEY_EXPIRY;
      const authParamsForSigner = {
        scope: YELLOW_CONFIG.SESSION_KEY_SCOPE,
        application: YELLOW_CONFIG.APPLICATION_NAME, // Must match what was sent in auth_request
        participant: this.mainAddress!, // Main wallet address
        session_key: this.sessionAddress!,
        expires_at: BigInt(expiresAt),
        allowances: [...YELLOW_CONFIG.DEFAULT_ALLOWANCES] as Array<{ asset: string; amount: string }>,
      };

      const eip712Signer = createEIP712AuthMessageSigner(
        this.mainWalletSigner,
        authParamsForSigner as any, // Type casting as the nitrolite types may not be fully accurate
        { name: YELLOW_CONFIG.APPLICATION_NAME }
      );

      // Pass the entire message object to createAuthVerifyMessage
      // Need to cast as any since the nitrolite types are restrictive
      const authVerifyMsg = await createAuthVerifyMessage(eip712Signer, message as any);

      // Parse if it's a string (like in working implementation)
      const msgToSend = typeof authVerifyMsg === 'string'
        ? JSON.parse(authVerifyMsg)
        : authVerifyMsg;

      await this.client.sendMessage(msgToSend);

      console.log('📤 Sent auth_verify');

      // IMPORTANT: Don't mark as authenticated yet - wait for server confirmation
      // The server will either send an auth_verify success or an error response
      console.log('⏳ Waiting for server authentication confirmation...');

      // Don't resolve the promise here - wait for handleAuthVerify or error handler
    } catch (error) {
      console.error('Failed to handle auth challenge:', error);

      // Reject the authentication promise
      if (this.authReject) {
        this.authReject(error);
        this.authResolve = undefined;
        this.authReject = undefined;
      }

      this.updateState({
        status: ConnectionStatus.ERROR,
        error: error instanceof Error ? error.message : 'Authentication failed',
      });

      throw error;
    }
  }

  private async handleAuthVerify(): Promise<void> {
    try {
      console.log('✅ Handling auth verify - setting status to AUTHENTICATED');
      console.log('  - Main address:', this.mainAddress);
      console.log('  - Session address:', this.sessionAddress);
      console.log('  - Session signer exists:', !!this.sessionSigner);

      this.updateState({
        status: ConnectionStatus.AUTHENTICATED,
        address: this.mainAddress,
        sessionKey: this.sessionAddress,
      });

      // Resolve the authentication promise
      if (this.authResolve) {
        console.log('✅ Resolving authentication promise');
        this.authResolve();
        this.authResolve = undefined;
        this.authReject = undefined;
      }

      // Don't fetch balance here - let the page do it explicitly
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

      let accountToQuery = this.mainAddress;

      const balanceMsg = await createGetLedgerBalancesMessage(
        this.sessionSigner,
        accountToQuery
      );

      const response = await this.client.sendMessage(balanceMsg);

      // The response comes back with balances in params.ledgerBalances
      const balances = (response as any).params?.ledgerBalances || [];

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
    // Note: Currently unified balance and wallet balance are the same
    // The ledger balance IS the wallet balance in Yellow Network
    return this.state.unifiedBalance;
  }

  getWalletBalances(): any[] {
    return this.state.walletBalances || [];
  }

  /**
   * Get the actual ledger balance (which is the same as wallet balance)
   */
  getLedgerBalance(): any[] {
    // In Yellow Network, the ledger balance IS your wallet balance
    // There isn't a separate "unified balance" - funds are either:
    // 1. In your ledger (wallet)
    // 2. Locked in channels/app sessions
    // 3. Transferred to broker for specific operations
    return this.state.unifiedBalance?.balances || this.state.walletBalances || [];
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
      // Log all messages for debugging
      console.log('📨 Received message:', {
        method: message.method,
        hasParams: !!message.params,
        hasError: !!(message.params as any)?.error,
        timestamp: new Date().toISOString()
      });

      // Log full details for important messages
      if (message.method &&
          (message.method === RPCMethod.AuthChallenge ||
           message.method === RPCMethod.AuthVerify ||
           message.method === RPCMethod.Error)) {
        console.log('📨 Full message:', JSON.stringify(message, null, 2));
      }

      // Log the actual method value for debugging
      if (typeof message.method === 'string') {
        console.log(`📥 Method value: "${message.method}"`);
      }

      switch (message.method) {
        case RPCMethod.AuthChallenge:
        case 'auth_challenge': // Handle both cases explicitly
          console.log('🔑 Processing auth_challenge');
          await this.handleAuthChallenge(message);
          break;

        case RPCMethod.AuthVerify:
        case 'auth_verify': // Handle both cases explicitly
          console.log('✅ Received auth_verify response - authentication successful!');
          await this.handleAuthVerify();
          break;

        case RPCMethod.BalanceUpdate:
          console.log('💰 Wallet balance update:', message.params);
          // Store wallet balance separately
          const walletBalances = (message.params as any)?.balanceUpdates || [];
          this.updateState({ walletBalances });
          this.emit('balance_update', message);
          break;

        case RPCMethod.Error:
        case 'error': // Handle both cases
          const errorMsg = (message.params as any)?.error || 'Unknown error';
          console.error('❌ Yellow Network error:', errorMsg);

          // Log request ID to trace which request failed
          if (message.requestId) {
            console.error(`   Request ID that failed: ${message.requestId}`);
          }

          this.emit('error', message);

          // Check for any auth-related errors
          const isAuthError = errorMsg.includes('authentication') ||
                             errorMsg.includes('challenge') ||
                             errorMsg.includes('signature') ||
                             errorMsg.includes('auth');

          // If we're waiting for auth and get an error, fail the auth
          if (this.authReject && isAuthError) {
            console.error('🚫 Authentication error detected, failing auth flow');
            this.updateState({
              status: ConnectionStatus.ERROR,
              error: errorMsg,
            });
            this.authReject(new Error(errorMsg));
            this.authReject = undefined;
            this.authResolve = undefined;
          }
          break;

        default:
          // Only handle auth_verify explicitly, don't guess authentication success
          // from other messages. This prevents false positives from messages like
          // "assets" that arrive during the auth flow.

          // During authentication, log non-auth messages but don't process them as auth success
          if (this.authResolve && message.method) {
            console.log(`📝 Received ${message.method} message during authentication flow`);
          }

          // Always emit to registered listeners for non-auth messages
          if (message.method) {
            this.emit(message.method, message);
          }
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

  /**
   * Get authentication details for debugging
   */
  getAuthDetails(): {
    isAuthenticated: boolean;
    status: ConnectionStatus;
    mainAddress?: string;
    sessionAddress?: string;
    hasSessionSigner: boolean;
  } {
    return {
      isAuthenticated: this.isAuthenticated(),
      status: this.state.status,
      mainAddress: this.mainAddress,
      sessionAddress: this.sessionAddress,
      hasSessionSigner: !!this.sessionSigner,
    };
  }

  // ============================================================================
  // Balance Management
  // ============================================================================

  /**
   * Check if user has enough balance for an operation
   */
  async hasBalance(asset: string, amount: string): Promise<boolean> {
    try {
      const balances = this.getLedgerBalance();
      const assetBalance = balances.find((b: any) => b.asset === asset);
      if (!assetBalance) return false;

      const currentBalance = BigInt(assetBalance.amount);
      const requiredAmount = BigInt(amount);

      return currentBalance >= requiredAmount;
    } catch {
      return false;
    }
  }

  
  // ============================================================================
  // App Sessions (Prediction Markets)
  // ============================================================================
  
  /**
   * Ensure we have a valid authentication before operations
   */
  async ensureAuthenticated(): Promise<void> {
    if (!this.isAuthenticated() || !this.sessionSigner) {
      console.log('⚠️ Not authenticated or session signer missing, need to authenticate first');
      throw new Error('Not authenticated. Please authenticate first before creating app sessions.');
    }

    // Double-check that all required auth components are present
    if (!this.mainAddress || !this.sessionAddress) {
      console.error('Authentication incomplete - missing addresses');
      throw new Error('Authentication incomplete - missing wallet or session addresses');
    }

    console.log('✅ Authentication verified');
  }

  /**
   * Use App Sessions to lock funds for betting
   * Create an App Session for a prediction market
   * Returns the app_session_id
   */
  async createAppSession(request: AppSessionRequest): Promise<string> {
    try {
      // More detailed authentication check
      console.log('🔍 Authentication check before createAppSession:');
      console.log('  - Connection status:', this.state.status);
      console.log('  - isAuthenticated():', this.isAuthenticated());
      console.log('  - Session signer exists:', !!this.sessionSigner);
      console.log('  - Main address:', this.mainAddress);
      console.log('  - Session address:', this.sessionAddress);

      // Ensure we're authenticated
      await this.ensureAuthenticated();

      console.log('🎲 Creating App Session for market...');

      // Create request with application field
      const rpcRequest = {
        ...request,
        definition: {
          ...request.definition,
          application: YELLOW_CONFIG.APPLICATION_NAME,
        },
      };

      console.log('📝 Creating app session message with session signer...');
      const message = await createAppSessionMessage(this.sessionSigner, rpcRequest as any);

      // Parse if it's a string (like in the SDK examples)
      const msgToSend = typeof message === 'string' ? JSON.parse(message) : message;

      // Log the message structure to check signatures
      console.log('📤 Sending app session message:');
      console.log('  - Method:', msgToSend.method);
      console.log('  - Has signatures:', !!msgToSend.signatures);
      console.log('  - Signatures count:', msgToSend.signatures?.length || 0);
      console.log('  - Full message:', JSON.stringify(msgToSend, null, 2));

      const response = await this.client.sendMessage(msgToSend);
      console.log('📥 App session response:', response);

      // The response format from the SDK examples shows it comes back directly in params
      if ((response as any).params?.appSessionId) {
        const appSessionId = (response as any).params.appSessionId;
        console.log('✅ App Session created:', appSessionId);
        return appSessionId;
      }

      // Try alternative response format
      const result = (response as any).res?.[2]?.[0];
      if (result?.app_session_id) {
        console.log('✅ App Session created:', result.app_session_id);
        return result.app_session_id;
      }

      // If neither format works, log the full response for debugging
      console.error('Unexpected response format:', JSON.stringify(response, null, 2));
      throw new Error('Failed to create app session - no session ID returned');
    } catch (error) {
      console.error('Failed to create app session:', error);
      throw error;
    }
  }

  /**
   * Join an existing market as a new participant with initial funds
   */
  async joinMarket(
    appSessionId: Hex,
    initialAmount: string,
    asset: string = 'ytest.usd'
  ): Promise<void> {
    try {
      if (!this.isAuthenticated() || !this.sessionSigner || !this.mainAddress) {
        throw new Error('Not authenticated');
      }

      console.log(`🎯 Joining market with ${initialAmount} ${asset}...`);

      // Fetch current state
      const appState = await this.getAppDefinition(appSessionId);

      console.log('📊 Current app state before joining:', {
        allocationsCount: appState.allocations.length,
        allocations: appState.allocations,
        participants: appState.participants
      });

      if (appState.status !== 'open') {
        throw new Error(`Cannot join ${appState.status} market`);
      }

      // Check if user already has an allocation (is a participant)
      const existingUserAllocation = appState.allocations.find(
        alloc => alloc.participant.toLowerCase() === this.mainAddress?.toLowerCase()
      );

      if (existingUserAllocation) {
        console.log('✅ User is already a participant with allocation:', existingUserAllocation);
        // If user already has allocation, we can just return (they don't need to join again)
        return;
      }

      // For DEPOSIT intent, we must ensure all existing allocations are preserved
      // and only add new funds (never decrease existing amounts)
      let newAllocations;

      if (appState.allocations.length === 0) {
        console.log('📝 Initializing empty session with user allocation');
        // Create initial allocations for all participants
        const participants = appState.participants || [
          '0x0000000000000000000000000000000000000001',
          '0x0000000000000000000000000000000000000002',
          '0x31889e28db474a43572e4f2cf235D657EEa9D88B'
        ];

        newAllocations = participants.map(p => ({
          participant: p,
          amount: '0',
          asset: asset
        }));

        // Add user with initial deposit
        newAllocations.push({
          participant: this.mainAddress,
          amount: initialAmount,
          asset: asset
        });
      } else {
        // IMPORTANT: Preserve all existing allocations exactly as they are
        // DEPOSIT intent requires that no allocation decreases
        newAllocations = appState.allocations.map(alloc => ({
          ...alloc,
          // Ensure we keep the exact same amount (never decrease)
          amount: alloc.amount || '0',
          asset: alloc.asset || asset
        }));

        // Add user allocation with the deposit amount
        newAllocations.push({
          participant: this.mainAddress,
          amount: initialAmount,
          asset: asset
        });
      }

      // Use DEPOSIT intent to add funds from unified balance
      const nextVersion = appState.version + 1;

      // Calculate total delta to verify it's positive
      const oldTotal = appState.allocations.reduce((sum, alloc) =>
        sum + BigInt(alloc.amount || '0'), BigInt(0));
      const newTotal = newAllocations.reduce((sum, alloc) =>
        sum + BigInt(alloc.amount || '0'), BigInt(0));
      const delta = newTotal - oldTotal;

      console.log('💰 Deposit calculations:', {
        oldTotal: oldTotal.toString(),
        newTotal: newTotal.toString(),
        delta: delta.toString(),
        isPositiveDelta: delta > BigInt(0)
      });

      if (delta <= BigInt(0)) {
        throw new Error(`Invalid deposit: delta must be positive but got ${delta}`);
      }

      const message = await createSubmitAppStateMessage(this.sessionSigner, {
        app_session_id: appSessionId,
        intent: RPCAppStateIntent.Deposit,
        version: nextVersion,
        allocations: newAllocations as any,
      });

      const msgToSend = typeof message === 'string' ? JSON.parse(message) : message;

      console.log('Sending DEPOSIT message to join market:', {
        version: nextVersion,
        userAmount: initialAmount,
        newParticipants: newAllocations.map(a => a.participant),
        allocations: newAllocations
      });

      const response = await this.client.sendMessage(msgToSend);

      if ((response as any)?.params?.error) {
        throw new Error(`Failed to join market: ${(response as any).params.error}`);
      }

      console.log('✅ Successfully joined market with initial deposit');
    } catch (error) {
      console.error('Failed to join market:', error);
      throw error;
    }
  }

  /**
   * Submit bet to App Session using OPERATE intent
   */
  async submitBet(
    appSessionId: Hex,
    poolAddress: Address,
    asset: string,
    amount: string
  ): Promise<void> {
    try {
      if (!this.isAuthenticated() || !this.sessionSigner) {
        console.error('Authentication check failed:', {
          isAuthenticated: this.isAuthenticated(),
          hasSessionSigner: !!this.sessionSigner,
          state: this.state
        });
        throw new Error('Not authenticated');
      }

      console.log(`🎯 Submitting bet: ${amount} ${asset} to ${poolAddress}...`);

      // Fetch current state from server to get accurate version and allocations
      console.log('Fetching current app state...');
      const appState = await this.getAppDefinition(appSessionId);
      let currentAllocations = appState.allocations;
      let currentVersion = appState.version;

      console.log('Current server state:', {
        version: currentVersion,
        allocationsCount: currentAllocations.length,
        status: appState.status
      });

      if (appState.status !== 'open') {
        throw new Error(`Cannot bet on ${appState.status} market`);
      }

      console.log('User address:', this.mainAddress);
      console.log('Session signer state:', {
        hasSessionSigner: !!this.sessionSigner,
        sessionAddress: this.sessionAddress,
        authStatus: this.state.status
      });

      // For OPERATE intent: move funds from user to pool (sum must stay constant)
      // Check if user has an allocation
      let userAllocation = currentAllocations.find(
        alloc => alloc.participant.toLowerCase() === this.mainAddress?.toLowerCase()
      );

      // If user doesn't have an allocation, we need to join the market first
      if (!userAllocation) {
        console.log('🔄 User not in market, joining first with initial deposit...');

        // Join the market with a DEPOSIT intent to add user as participant
        await this.joinMarket(appSessionId, amount, asset);

        // Re-fetch state after joining
        console.log('Re-fetching app state after joining...');
        const newAppState = await this.getAppDefinition(appSessionId);
        currentAllocations = newAppState.allocations;
        currentVersion = newAppState.version;

        // Now check again for user allocation
        userAllocation = currentAllocations.find(
          alloc => alloc.participant.toLowerCase() === this.mainAddress?.toLowerCase()
        );

        if (!userAllocation) {
          throw new Error('Failed to add user to market participants');
        }

        // Now we can place the bet
        console.log('✅ User successfully joined market, now placing bet...');
      }

      const userBalance = BigInt(userAllocation.amount || '0');
      if (userBalance < BigInt(amount)) {
        throw new Error(`Insufficient balance: ${userBalance} < ${amount}`);
      }

      // Update allocations: move funds from user to pool
      // IMPORTANT: Preserve all fields including 'asset'
      const newAllocations = currentAllocations.map((alloc) => {
        // Ensure asset field is present
        const allocWithAsset = {
          ...alloc,
          asset: alloc.asset || asset // Use provided asset if allocation doesn't have one
        };

        if (alloc.participant.toLowerCase() === poolAddress.toLowerCase()) {
          // Increase pool amount
          const oldAmount = BigInt(alloc.amount || '0');
          const newAmount = oldAmount + BigInt(amount);
          console.log(`Pool ${poolAddress}: ${oldAmount} -> ${newAmount}`);
          return {
            ...allocWithAsset,
            amount: newAmount.toString(),
          };
        } else if (alloc.participant.toLowerCase() === this.mainAddress?.toLowerCase()) {
          // Decrease user amount
          const newAmount = userBalance - BigInt(amount);
          console.log(`User ${this.mainAddress}: ${userBalance} -> ${newAmount}`);
          return {
            ...allocWithAsset,
            amount: newAmount.toString(),
          };
        }
        console.log(`Unchanged participant ${alloc.participant}: ${alloc.amount}`);
        return allocWithAsset;
      });

      console.log('New allocations after bet:', newAllocations);

      // Log each allocation for debugging
      newAllocations.forEach((alloc, i) => {
        console.log(`  Allocation ${i}: ${alloc.participant} = ${alloc.amount} ${alloc.asset || 'ytest.usd'}`);
      });

      // Verify total remains constant for OPERATE (per asset)
      const assetToCheck = asset;
      const oldTotal = currentAllocations
        .filter(alloc => (alloc.asset || assetToCheck) === assetToCheck)
        .reduce((sum, alloc) => sum + BigInt(alloc.amount || '0'), 0n);

      const newTotal = newAllocations
        .filter(alloc => (alloc.asset || assetToCheck) === assetToCheck)
        .reduce((sum, alloc) => sum + BigInt(alloc.amount || '0'), 0n);

      const delta = newTotal - oldTotal;

      console.log(`Old total for ${assetToCheck}: ${oldTotal}`);
      console.log(`New total for ${assetToCheck}: ${newTotal}`);
      console.log(`Delta: ${delta}`);

      if (delta !== 0n) {
        throw new Error(`Invalid allocation delta for OPERATE: ${delta} (should be 0)`);
      }

      console.log(`✅ Allocation delta: ${delta} (correct for OPERATE intent)`);

      // Increment version from current state
      const nextVersion = currentVersion + 1;

      // Try OPERATE intent - it seems to work without special signatures
      console.log('Creating OPERATE message with:', {
        appSessionId,
        intent: 'OPERATE',
        currentVersion,
        nextVersion,
        hasSessionSigner: !!this.sessionSigner,
        sessionAddress: this.sessionAddress
      });

      // Ensure session signer is still valid
      if (!this.sessionSigner) {
        throw new Error('Session signer lost - need to re-authenticate');
      }

      const message = await createSubmitAppStateMessage(this.sessionSigner, {
        app_session_id: appSessionId,
        intent: RPCAppStateIntent.Operate,
        version: nextVersion,
        allocations: newAllocations as any, // Type cast since our Allocation type uses string for participant
      });

      // Parse if it's a string
      const msgToSend = typeof message === 'string' ? JSON.parse(message) : message;

      console.log('Sending OPERATE message:', {
        hasSignatures: !!(msgToSend.signatures && msgToSend.signatures.length > 0),
        signatureCount: msgToSend.signatures?.length || 0,
        method: msgToSend.method,
        requestId: msgToSend.requestId
      });

      try {
        const response = await this.client.sendMessage(msgToSend);
        console.log('✅ Bet message sent');
        console.log('OPERATE response:', response);

        // Check if response indicates success
        if ((response as any)?.params?.error) {
          throw new Error(`Server error: ${(response as any).params.error}`);
        }

        console.log('✅ Bet submitted successfully');
      } catch (sendError) {
        console.error('Failed to send OPERATE message:', sendError);
        throw sendError;
      }
    } catch (error) {
      console.error('Failed to submit bet:', error);
      throw error;
    }
  }

  /**
   * Get App Session definition (to read current allocations and version)
   */
  async getAppDefinition(appSessionId: Hex): Promise<{
    allocations: Allocation[];
    version: number;
    status: string;
    participants?: string[];
    weights?: number[];
    quorum?: number;
  }> {
    try {
      if (!this.isAuthenticated() || !this.sessionSigner) {
        throw new Error('Not authenticated');
      }

      const message = await createGetAppDefinitionMessage(
        this.sessionSigner,
        appSessionId
      );

      // Parse if it's a string
      const msgToSend = typeof message === 'string' ? JSON.parse(message) : message;
      console.log('📤 Sending get_app_definition message:', msgToSend);

      const response = await this.client.sendMessage(msgToSend);
      console.log('📄 App definition raw response:', JSON.stringify(response, null, 2));

      // Parse response and extract allocations with version
      let allocations: Allocation[] = [];
      let version = 1;
      let status = 'open';
      let participants: string[] = [];
      let weights: number[] = [];
      let quorum = 100;

      // Try different response formats and extract data
      const responseData = (response as any).params ||
                          (response as any).res?.[2] ||
                          (response as any).result ||
                          response;

      // Extract allocations from various possible locations
      if (responseData?.state?.allocations) {
        allocations = responseData.state.allocations;
        version = responseData.state.version || 1;
      } else if (responseData?.allocations) {
        allocations = responseData.allocations;
        version = responseData.version || 1;
      } else if (responseData?.current_state?.allocations) {
        allocations = responseData.current_state.allocations;
        version = responseData.current_state.version || 1;
      } else if (Array.isArray(responseData) && responseData.length > 0) {
        const firstItem = responseData[0];
        if (firstItem?.state?.allocations) {
          allocations = firstItem.state.allocations;
          version = firstItem.state.version || 1;
        } else if (firstItem?.allocations) {
          allocations = firstItem.allocations;
          version = firstItem.version || 1;
        }
      }

      // Extract other metadata
      if (responseData?.status) {
        status = responseData.status;
      }
      if (responseData?.participants) {
        participants = responseData.participants;
      }
      if (responseData?.weights) {
        weights = responseData.weights;
      }
      if (responseData?.quorum !== undefined) {
        quorum = responseData.quorum;
      }

      console.log('📊 Parsed app definition:', {
        allocationsCount: allocations.length,
        version,
        status,
        participantsCount: participants.length
      });

      return {
        allocations,
        version,
        status,
        participants,
        weights,
        quorum
      };
    } catch (error) {
      console.error('Failed to get app definition:', error);
      throw error;
    }
  }

  /**
   * Get current app state including version
   */
  async getAppState(appSessionId: Hex): Promise<{ version: number; allocations: Allocation[] }> {
    try {
      if (!this.isAuthenticated() || !this.sessionSigner) {
        throw new Error('Not authenticated');
      }

      // Use the SDK method to get app definition which includes state
      const message = await createGetAppDefinitionMessage(
        this.sessionSigner,
        appSessionId
      );

      // Send the message as-is from the SDK (don't convert the format)
      const msgToSend = typeof message === 'string' ? JSON.parse(message) : message;

      const response = await this.client.sendMessage(msgToSend);
      console.log('📊 Current app state response:', response);

      // Extract version and allocations from response
      const result = (response as any).result || (response as any).params || {};
      const allocations = result.allocations || result.state?.allocations || [];
      const version = result.version || result.state?.version || 1;

      return {
        version,
        allocations
      };
    } catch (error) {
      console.error('Failed to get app state:', error);
      // Return default values if state fetch fails
      return { version: 1, allocations: [] };
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

      console.log('🔍 Fetching app sessions for participant:', participant, 'status:', status);
      const response = await this.client.sendMessage(message);
      console.log('📊 App sessions response:', response);

      // Try different response formats
      if ((response as any).params?.appSessions) {
        return (response as any).params.appSessions;
      }

      if ((response as any).result) {
        return (response as any).result;
      }

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
        throw new Error('Not authenticated or session signer missing. Please authenticate first.');
      }

      console.log('🏁 Closing App Session:', appSessionId);
      console.log('Session signer available:', !!this.sessionSigner);
      console.log('Final allocations:', finalAllocations);

      // Calculate total amount in allocations
      const totalAmount = finalAllocations.reduce((sum, alloc) => {
        return sum + BigInt(alloc.amount);
      }, BigInt(0));

      console.log('Total amount to redistribute:', totalAmount.toString());

      // Try to get current app state but don't fail if it doesn't work
      let adjustedAllocations = [...finalAllocations];
      let isEmptySession = false;

      try {
        const currentState = await this.getAppState(appSessionId);
        console.log('Current app state:', currentState);

        // Check if session has any allocations at all
        if (!currentState.allocations || currentState.allocations.length === 0) {
          console.log('📭 Session is empty (no allocations)');
          isEmptySession = true;
          // For empty sessions, we still need to provide an allocation with 0 amount
          // Keep the original allocation structure but ensure amount is "0"
          if (adjustedAllocations.length > 0) {
            adjustedAllocations[0].amount = "0";
          }
        } else {
          const currentTotal = currentState.allocations.reduce((sum, alloc) => {
            return sum + BigInt(alloc.amount);
          }, BigInt(0));

          console.log('Current total in app state:', currentTotal.toString());

          // If trying to close with 0 but there's funds in the session, redistribute properly
          if (totalAmount === BigInt(0) && currentTotal > BigInt(0)) {
            console.log('⚠️ Adjusting allocations to redistribute all funds');
            adjustedAllocations[0].amount = currentTotal.toString();
          }
        }
      } catch (stateError) {
        console.log('⚠️ Could not fetch current state, proceeding with provided allocations');
        // Keep the allocations as provided - they already have amount "0" for empty sessions
      }

      const message = await createCloseAppSessionMessage(this.sessionSigner, {
        app_session_id: appSessionId,
        allocations: adjustedAllocations as any,
      });

      console.log('Raw message from createCloseAppSessionMessage:', message);
      console.log('Message type:', typeof message);

      // The nitrolite SDK returns messages in a special format that should be sent as-is
      // Just parse if it's a string, but don't convert the format
      const msgToSend = typeof message === 'string' ? JSON.parse(message) : message;

      // Log what we're actually sending
      console.log('Sending close message (raw format):', JSON.stringify(msgToSend, null, 2));

      const response = await this.client.sendMessage(msgToSend);
      console.log('Close session response:', response);

      // Check for errors in response
      if ((response as any)?.params?.error) {
        const errorMsg = (response as any).params.error;

        // Provide helpful context for specific errors
        if (errorMsg === 'authentication required') {
          console.error('Authentication lost - session key may have expired');
          throw new Error('Authentication required. Please re-authenticate to close the session.');
        }

        if (errorMsg.includes('not fully redistributed')) {
          console.error('Asset redistribution error:', {
            providedAllocations: adjustedAllocations,
            totalAmount: totalAmount.toString(),
            isEmptySession
          });

          if (isEmptySession) {
            throw new Error('Cannot close empty session. Please make a deposit/bet first before closing.');
          }

          throw new Error(`Asset redistribution error: ${errorMsg}. Check that all funds are properly allocated.`);
        }

        if (errorMsg.includes('missing required parameters')) {
          console.error('Missing parameters error:', {
            providedAllocations: adjustedAllocations,
            errorMsg
          });
          throw new Error(`Invalid close request: ${errorMsg}. The session may need deposits before it can be closed.`);
        }

        throw new Error(`Failed to close session: ${errorMsg}`);
      }

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
