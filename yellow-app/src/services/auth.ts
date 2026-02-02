/**
 * Authentication Service for Yellow Network
 * Handles session key generation, EIP-712 signing, and auth flow
 */

import {
  createAuthRequestMessage,
  createAuthVerifyMessageFromChallenge,
  createEIP712AuthMessageSigner,
  createECDSAMessageSigner
} from '@erc7824/nitrolite';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import type { WalletClient, Address } from 'viem';
import { getWebSocketManager, WebSocketManager } from './websocket';

/**
 * Authentication service class
 * Manages the authentication flow with Yellow Network
 */
export class AuthService {
  private sessionPrivateKey: `0x${string}` | null = null;
  private sessionSigner: any = null;
  private sessionAddress: Address | null = null;
  private sessionExpiry: bigint | null = null;
  private wsManager: WebSocketManager;

  constructor(wsManager: WebSocketManager) {
    this.wsManager = wsManager;
  }

  /**
   * Initialize authentication with Yellow Network
   * @param walletClient - Viem wallet client for signing
   * @param userAddress - User's wallet address
   * @param allowances - Token allowances for the session
   * @returns Promise that resolves when authenticated
   */
  async authenticate(
    walletClient: WalletClient,
    userAddress: Address,
    allowances: Array<{ asset: string; amount: string }> = [
      { asset: 'ytest.usd', amount: '1000000000' } // 1000 USDC with 6 decimals
    ]
  ): Promise<void> {
    console.log('[Auth] Starting authentication for:', userAddress);

    // Generate temporary session key
    this.sessionPrivateKey = generatePrivateKey();
    this.sessionSigner = createECDSAMessageSigner(this.sessionPrivateKey);
    const sessionAccount = privateKeyToAccount(this.sessionPrivateKey);
    this.sessionAddress = sessionAccount.address;

    // Calculate session expiry (1 hour from now)
    this.sessionExpiry = BigInt(Math.floor(Date.now() / 1000) + 3600);

    // Prepare auth parameters
    const authParams = {
      address: this.sessionAddress,
      application: 'Nitrolite Prediction Market',
      session_key: this.sessionAddress,
      allowances,
      expires_at: this.sessionExpiry,
      scope: 'prediction.market'
    };

    // Create and send auth request
    const authRequestMsg = await createAuthRequestMessage(authParams);

    console.log('[Auth] Sending auth request...');

    return new Promise((resolve, reject) => {
      // Set up challenge handler
      const challengeHandler = async (data: any) => {
        console.log('[Auth] Received auth challenge');

        try {
          const challenge = data.res[2].challenge_message;

          // Sign challenge with main wallet
          const signer = createEIP712AuthMessageSigner(
            walletClient,
            authParams,
            { name: 'Nitrolite Prediction Market' }
          );

          const verifyMsg = await createAuthVerifyMessageFromChallenge(
            signer,
            challenge
          );

          console.log('[Auth] Sending auth verification...');

          // Send verification
          this.wsManager.send(JSON.parse(verifyMsg) as any);
        } catch (error) {
          console.error('[Auth] Error handling challenge:', error);
          reject(error);
        }
      };

      // Set up success handler
      const successHandler = (_data: any) => {
        console.log('[Auth] Authentication successful!');
        console.log('[Auth] Session key:', this.sessionAddress);
        console.log('[Auth] Session expires:', new Date(Number(this.sessionExpiry) * 1000));

        // Clean up listeners
        this.wsManager.removeListener('auth_challenge', challengeHandler);
        this.wsManager.removeListener('auth_success', successHandler);

        resolve();
      };

      // Set up error handler
      const errorHandler = (data: any) => {
        if (data.res && data.res[1] === 'auth_request' && data.res[0] === 0) {
          console.error('[Auth] Authentication error:', data.res[2]);

          // Clean up listeners
          this.wsManager.removeListener('auth_challenge', challengeHandler);
          this.wsManager.removeListener('auth_success', successHandler);
          this.wsManager.removeListener('error', errorHandler);

          reject(new Error(data.res[2]));
        }
      };

      // Register listeners
      this.wsManager.once('auth_challenge', challengeHandler);
      this.wsManager.once('auth_success', successHandler);
      this.wsManager.on('error', errorHandler);

      // Send auth request
      this.wsManager.send(JSON.parse(authRequestMsg) as any);

      // Timeout after 30 seconds
      setTimeout(() => {
        this.wsManager.removeListener('auth_challenge', challengeHandler);
        this.wsManager.removeListener('auth_success', successHandler);
        this.wsManager.removeListener('error', errorHandler);

        reject(new Error('Authentication timeout'));
      }, 30000);
    });
  }

  /**
   * Get the current session signer
   * @returns Session signer or null if not authenticated
   */
  getSessionSigner() {
    if (!this.sessionSigner) {
      throw new Error('Not authenticated. Please authenticate first.');
    }
    return this.sessionSigner;
  }

  /**
   * Get the current session address
   * @returns Session address or null if not authenticated
   */
  getSessionAddress(): Address | null {
    return this.sessionAddress;
  }

  /**
   * Check if the session is still valid
   * @returns True if authenticated and session not expired
   */
  isAuthenticated(): boolean {
    if (!this.sessionExpiry) {
      return false;
    }

    const now = BigInt(Math.floor(Date.now() / 1000));
    return now < this.sessionExpiry;
  }

  /**
   * Get time until session expiry
   * @returns Seconds until expiry or 0 if expired
   */
  getTimeUntilExpiry(): number {
    if (!this.sessionExpiry) {
      return 0;
    }

    const now = BigInt(Math.floor(Date.now() / 1000));
    const remaining = this.sessionExpiry - now;

    return remaining > 0n ? Number(remaining) : 0;
  }

  /**
   * Clear session data (logout)
   */
  clearSession(): void {
    console.log('[Auth] Clearing session');
    this.sessionPrivateKey = null;
    this.sessionSigner = null;
    this.sessionAddress = null;
    this.sessionExpiry = null;
  }
}

// Export singleton instance
let authService: AuthService | null = null;

/**
 * Get or create auth service instance
 * @returns Auth service instance
 */
export function getAuthService(): AuthService {
  if (!authService) {
    const wsManager = getWebSocketManager();
    authService = new AuthService(wsManager);
  }

  return authService;
}