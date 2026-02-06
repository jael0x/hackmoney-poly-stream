/**
 * Yellow Network Client Service using yellow-ts
 * Simplified connection and authentication
 */

import { Client } from 'yellow-ts';
import {
  createAuthRequestMessage,
  createAuthVerifyMessage,
  createEIP712AuthMessageSigner,
  createECDSAMessageSigner,
} from '@erc7824/nitrolite';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import type { WalletClient, Address } from 'viem';

const YELLOW_WS_URL = process.env.NEXT_PUBLIC_YELLOW_WS_URL || 'wss://clearnet.yellow.com/ws';

export interface YellowClientState {
  isConnected: boolean;
  isAuthenticated: boolean;
  sessionKey: Address | null;
  sessionExpiry: number | null;
}

export class YellowClientService {
  private client: Client;
  private sessionPrivateKey: `0x${string}` | null = null;
  private sessionSigner: ReturnType<typeof createECDSAMessageSigner> | null = null;
  private sessionAddress: Address | null = null;
  private sessionExpiry: number | null = null;
  private isAuthenticated = false;

  constructor(url: string = YELLOW_WS_URL) {
    this.client = new Client({
      url,
      requestTimeoutMs: 30000,
    });
  }

  /**
   * Connect to Yellow Network
   */
  async connect(): Promise<void> {
    console.log('[YellowClient] Connecting...');
    await this.client.connect();
    console.log('[YellowClient] Connected!');

    // Set up listeners for server messages
    this.client.listen((message: any) => {
      console.log('[YellowClient] Message received:', message);
    });
  }

  /**
   * Disconnect from Yellow Network
   */
  async disconnect(): Promise<void> {
    console.log('[YellowClient] Disconnecting...');
    await this.client.disconnect();
    this.clearSession();
    console.log('[YellowClient] Disconnected');
  }

  /**
   * Authenticate with Yellow Network
   */
  async authenticate(
    walletClient: WalletClient,
    userAddress: Address
  ): Promise<void> {
    console.log('[YellowClient] Starting authentication for:', userAddress);

    // Generate session key
    this.sessionPrivateKey = generatePrivateKey();
    this.sessionSigner = createECDSAMessageSigner(this.sessionPrivateKey);
    const sessionAccount = privateKeyToAccount(this.sessionPrivateKey);
    this.sessionAddress = sessionAccount.address;
    this.sessionExpiry = Math.floor(Date.now() / 1000) + 3600;

    // Create a promise to handle the async authentication flow
    return new Promise(async (resolve, reject) => {
      let authChallengeReceived = false;

      // Set up listener for auth challenge BEFORE sending auth request
      const handleMessage = async (message: any) => {
        console.log('[YellowClient] Received message:', message);

        // Check if this is an auth challenge response
        if (message?.method === 'auth_challenge' ||
            message?.res?.[1] === 'auth_challenge') {

          if (authChallengeReceived) return; // Prevent duplicate handling
          authChallengeReceived = true;

          console.log('[YellowClient] Auth challenge received:', JSON.stringify(message, null, 2));

          try {
            // Create auth params matching the challenge requirements
            const authParams = {
              scope: 'console', // or 'test.app' depending on your setup
              application: userAddress, // Using user address as application
              participant: this.sessionAddress!,
              expire: String(this.sessionExpiry!),
              allowances: [],
              session_key: this.sessionAddress!,
              expires_at: BigInt(this.sessionExpiry!),
            };

            console.log('[YellowClient] Creating EIP-712 signer with params:', authParams);

            // Create EIP-712 signer - note: NO await here as the function is not async
            const domain = { name: 'Test app' }; // Simple domain name
            const eip712Signer = createEIP712AuthMessageSigner(
              walletClient,
              authParams,
              domain
            );

            // Create verify message with the challenge response
            const verifyMsg = await createAuthVerifyMessage(eip712Signer, message);
            console.log('[YellowClient] Sending verify message:', verifyMsg);

            // Send verify message
            await this.client.sendMessage(JSON.parse(verifyMsg));

          } catch (error) {
            console.error('[YellowClient] Error handling auth challenge:', error);
            reject(error);
          }
        }

        // Check if this is an auth verify response (success)
        if (message?.method === 'auth_verify' ||
            message?.res?.[1] === 'auth_verify') {

          console.log('[YellowClient] Auth verify response received:', JSON.stringify(message, null, 2));

          // Check for errors
          const error = message?.params?.error || message?.res?.[2]?.error;
          if (error) {
            console.error('[YellowClient] Authentication failed:', error);
            reject(new Error(`Authentication failed: ${error}`));
          } else {
            console.log('[YellowClient] ✅ Authentication successful!');
            this.isAuthenticated = true;
            resolve();
          }
        }

        // Check for error messages
        if (message?.method === 'error' || message?.error) {
          const error = message?.error || message?.params?.error || 'Unknown error';
          console.error('[YellowClient] Error received:', error);
          reject(new Error(`Authentication error: ${error}`));
        }
      };

      // Register the listener
      this.client.listen(handleMessage);

      // Auth params for the initial request
      const authParams = {
        address: userAddress,
        session_key: this.sessionAddress!,
        application: 'Test app', // Simplified application name
        allowances: [], // Empty allowances for testing
        expires_at: BigInt(this.sessionExpiry!),
        scope: 'console', // or 'test.app'
      };

      console.log('[YellowClient] Auth request params:', authParams);

      // Create and send auth request message
      const authRequestMsg = await createAuthRequestMessage(authParams);
      console.log('[YellowClient] Sending auth request:', authRequestMsg);

      // Send the auth request (this triggers the challenge response)
      await this.client.sendMessage(JSON.parse(authRequestMsg));

      // Set a timeout for the authentication process
      setTimeout(() => {
        if (!this.isAuthenticated) {
          reject(new Error('Authentication timeout - no response received'));
        }
      }, 30000); // 30 second timeout
    });
  }

  /**
   * Get current state
   */
  getState(): YellowClientState {
    return {
      isConnected: true, // TODO: track actual connection state
      isAuthenticated: this.isAuthenticated,
      sessionKey: this.sessionAddress,
      sessionExpiry: this.sessionExpiry,
    };
  }

  /**
   * Get the underlying client for direct access
   */
  getClient(): Client {
    return this.client;
  }

  /**
   * Get session signer
   */
  getSessionSigner() {
    return this.sessionSigner;
  }

  /**
   * Clear session data
   */
  private clearSession(): void {
    this.sessionPrivateKey = null;
    this.sessionSigner = null;
    this.sessionAddress = null;
    this.sessionExpiry = null;
    this.isAuthenticated = false;
  }
}

// Singleton instance
let yellowClient: YellowClientService | null = null;

export function getYellowClient(url?: string): YellowClientService {
  if (!yellowClient) {
    yellowClient = new YellowClientService(url);
  }
  return yellowClient;
}
