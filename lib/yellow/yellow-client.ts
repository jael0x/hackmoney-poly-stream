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

  constructor(url: string = process.env.NEXT_PUBLIC_YELLOW_WS_URL || 'wss://clearnet-sandbox.yellow.com/ws') {
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

    // Auth params
    const authParams = {
      address: userAddress,
      session_key: this.sessionAddress,
      application: 'Nitrolite Prediction Market',
      expires_at: BigInt(this.sessionExpiry),
      allowances: [],
      scope: 'console',
    };

    console.log('[YellowClient] Auth params:', authParams);

    // Create auth request message
    const authRequestMsg = await createAuthRequestMessage(authParams);
    console.log('[YellowClient] Auth request message:', authRequestMsg);

    // Send auth request and wait for challenge
    const authResponse = await this.client.sendMessage(JSON.parse(authRequestMsg));
    console.log('[YellowClient] Auth response:', authResponse);
    console.log('[YellowClient] Auth response (JSON):', JSON.stringify(authResponse, null, 2));
    console.log('[YellowClient] res[1]:', authResponse?.res?.[1]);
    console.log('[YellowClient] res[2]:', authResponse?.res?.[2]);

    // Check if we got a challenge - try different formats
    const challengeMessage =
      authResponse?.res?.[2]?.challenge_message ||
      authResponse?.res?.[2]?.challengeMessage ||
      authResponse?.params?.challenge_message ||
      authResponse?.params?.challengeMessage;

    console.log('[YellowClient] Challenge message found:', challengeMessage);

    if (challengeMessage) {
      console.log('[YellowClient] Got challenge:', challengeMessage);

      // Create EIP-712 signer for the challenge
      const domain = { name: 'Nitrolite Prediction Market' };
      const eip712Signer = createEIP712AuthMessageSigner(
        walletClient,
        {
          session_key: this.sessionAddress,
          expires_at: BigInt(this.sessionExpiry),
          allowances: [],
          scope: 'console',
        },
        domain
      );

      // Create verify message
      const verifyMsg = await createAuthVerifyMessage(eip712Signer, authResponse);
      console.log('[YellowClient] Verify message:', verifyMsg);

      // Send verify and wait for success
      const verifyResponse = await this.client.sendMessage(JSON.parse(verifyMsg));
      console.log('[YellowClient] Verify response:', verifyResponse);
      console.log('[YellowClient] Verify response (JSON):', JSON.stringify(verifyResponse, null, 2));

      // Check for success - response format: {method: 'auth_verify', params: {...}}
      // If we get auth_verify back with no error, authentication succeeded
      if (
        verifyResponse?.method === 'auth_verify' ||
        (verifyResponse?.res?.[0] === 1 && verifyResponse?.res?.[1] === 'auth_verify')
      ) {
        console.log('[YellowClient] ✅ Authentication successful!');
        this.isAuthenticated = true;
      } else if (verifyResponse?.params?.error || verifyResponse?.res?.[2]?.error) {
        const error = verifyResponse?.params?.error || verifyResponse?.res?.[2]?.error;
        throw new Error(`Authentication failed: ${error}`);
      } else {
        // If we got a response without error, assume success
        console.log('[YellowClient] ✅ Authentication completed (assuming success)');
        this.isAuthenticated = true;
      }
    } else {
      throw new Error('No challenge received from server');
    }
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
