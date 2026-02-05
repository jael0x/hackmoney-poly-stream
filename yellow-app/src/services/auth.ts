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
   * Check if there's an existing valid session for the user
   * @returns True if authenticated and session not expired
   */
  hasValidSession(): boolean {
    return this.isAuthenticated();
  }

  /**
   * Initialize authentication with Yellow Network
   * @param walletClient - Viem wallet client for signing
   * @param userAddress - User's wallet address
   * @param allowances - Token allowances for the session
   * @param forceReauth - Force reauthentication even if session exists
   * @returns Promise that resolves when authenticated
   */
  async authenticate(
    walletClient: WalletClient,
    userAddress: Address,
    allowances: Array<{ asset: string; amount: string }> = [], // Empty allowances for now
    forceReauth: boolean = false
  ): Promise<void> {
    console.log('[Auth] Starting authentication for:', userAddress);

    // Check if we already have a valid session
    if (!forceReauth && this.hasValidSession()) {
      console.log('[Auth] Already authenticated with valid session');
      console.log('[Auth] Session key:', this.sessionAddress);
      console.log('[Auth] Time until expiry:', this.getTimeUntilExpiry(), 'seconds');
      return;
    }

    // Clear any existing session before starting new authentication
    if (this.sessionAddress || this.sessionPrivateKey) {
      console.log('[Auth] Clearing existing session before new authentication');
      await this.logout();

      // Small delay to ensure server processes the logout
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Generate temporary session key
    this.sessionPrivateKey = generatePrivateKey();
    this.sessionSigner = createECDSAMessageSigner(this.sessionPrivateKey);
    const sessionAccount = privateKeyToAccount(this.sessionPrivateKey);
    this.sessionAddress = sessionAccount.address;

    // Calculate session expiry (1 hour from now)
    this.sessionExpiry = BigInt(Math.floor(Date.now() / 1000) + 3600);

    // Prepare auth parameters - use user's actual address, not session address
    const authParams = {
      address: userAddress,  // Use checksummed address
      application: 'Nitrolite Prediction Market',
      session_key: this.sessionAddress,  // Use checksummed session key
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
        console.log('[Auth] Received auth challenge, data:', data);

        try {
          const challenge = data.res[2].challenge_message;
          console.log('[Auth] Challenge message:', challenge);

          // Sign challenge with main wallet
          console.log('[Auth] Creating EIP-712 signer with params:', authParams);
          console.log('[Auth] Wallet client:', walletClient);

          try {
            // Create signer with proper wallet client
            const signerAccount = walletClient.account || userAddress;
            console.log('[Auth] Using account for signer:', signerAccount);

            // Get the chain ID from the wallet client
            const chainId = await walletClient.getChainId();
            console.log('[Auth] Current chain ID:', chainId);

            // Create domain configuration for Yellow Network
            // According to Nitrolite docs, domain only needs 'name' for auth
            const domain = {
              name: 'Nitrolite Prediction Market'
            };

            console.log('[Auth] Creating signer with domain:', domain);
            console.log('[Auth] Auth params being used:', authParams);

            // Create the EIP-712 signer - this should trigger the wallet signing dialog
            console.log('[Auth] About to create EIP-712 signer...');
            console.log('[Auth] Wallet client chain:', await walletClient.getChainId());
            console.log('[Auth] Wallet client account:', walletClient.account);

            const signer = await createEIP712AuthMessageSigner(
              walletClient,
              authParams,
              domain
            );

            console.log('[Auth] Signer created successfully, signing challenge...');

            try {
              // Create the verification message with the signed challenge
              const verifyMsg = await createAuthVerifyMessageFromChallenge(
                signer,
                challenge
              );

              console.log('[Auth] Verification message created:', verifyMsg);

              // Send verification message
              this.wsManager.send(JSON.parse(verifyMsg) as any);
            } catch (verifyError) {
              console.error('[Auth] Error creating verify message:', verifyError);
              console.error('[Auth] Error details:', verifyError);
              throw verifyError;
            }
          } catch (signError) {
            console.error('[Auth] Error during signing:', signError);
            throw signError;
          }
        } catch (error) {
          console.error('[Auth] Error handling challenge:', error);
          reject(error);
        }
      };

      // Set up success handler
      const successHandler = (data: any) => {
        console.log('[Auth] Authentication successful!', data);
        console.log('[Auth] Session key:', this.sessionAddress);
        console.log('[Auth] Session expires:', new Date(Number(this.sessionExpiry) * 1000));

        // Clean up listeners
        this.wsManager.removeListener('auth_challenge', challengeHandler);
        this.wsManager.removeListener('auth_success', successHandler);
        this.wsManager.removeListener('error', errorHandler);

        resolve();
      };

      // Set up error handler
      const errorHandler = (data: any) => {
        // Handle generic error responses (method === 'error')
        if (data.res && data.res[1] === 'error') {
          const errorDetails = data.res[2];
          console.error('[Auth] Authentication error:', errorDetails);

          let errorMessage = 'Authentication failed';
          if (errorDetails?.error) {
            errorMessage = errorDetails.error;

            // Special handling for specific error messages
            if (errorDetails.error === 'invalid challenge or signature') {
              console.error('[Auth] Invalid signature - possible causes:');
              console.error('  1. Challenge expired (>5 minutes)');
              console.error('  2. Wrong wallet/chain');
              console.error('  3. Session already exists');
              errorMessage = 'Authentication failed: Invalid signature. Please try again.';
            }
          } else if (typeof errorDetails === 'string') {
            errorMessage = errorDetails;
          }

          // Clean up listeners
          this.wsManager.removeListener('auth_challenge', challengeHandler);
          this.wsManager.removeListener('auth_success', successHandler);
          this.wsManager.removeListener('error', errorHandler);

          reject(new Error(errorMessage));
          return;
        }

        // Check for auth_request errors
        if (data.res && data.res[1] === 'auth_request' && data.res[0] === 0) {
          console.error('[Auth] Authentication request error:', data.res[2]);

          // Clean up listeners
          this.wsManager.removeListener('auth_challenge', challengeHandler);
          this.wsManager.removeListener('auth_success', successHandler);
          this.wsManager.removeListener('error', errorHandler);

          reject(new Error(data.res[2]));
        }

        // Check for auth_verify errors
        if (data.res && data.res[1] === 'auth_verify' && data.res[0] === 0) {
          console.error('[Auth] Authentication verify error:', data.res[2]);

          // Clean up listeners
          this.wsManager.removeListener('auth_challenge', challengeHandler);
          this.wsManager.removeListener('auth_success', successHandler);
          this.wsManager.removeListener('error', errorHandler);

          reject(new Error(`Authentication verification failed: ${data.res[2]}`));
        }
      };

      // Register listeners BEFORE sending the request
      console.log('[Auth] Registering event listeners...');
      this.wsManager.once('auth_challenge', challengeHandler);
      this.wsManager.once('auth_success', successHandler);
      this.wsManager.on('error', errorHandler);

      // Small delay to ensure handlers are registered
      setTimeout(() => {
        console.log('[Auth] Sending auth request message...');
        // Send auth request
        this.wsManager.send(JSON.parse(authRequestMsg) as any);
      }, 100);

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
   * Send logout/close session message to server
   * @returns Promise that resolves when logout is complete
   */
  async logout(): Promise<void> {
    console.log('[Auth] Sending logout request...');

    try {
      // Try to send a logout/close session message
      // This is a best-effort attempt - we don't wait for response
      const logoutMsg = {
        req: [1, 'close_session', {}, Date.now()],
        sig: []
      };

      this.wsManager.send(logoutMsg as any, false);
      console.log('[Auth] Logout request sent');
    } catch (error) {
      console.warn('[Auth] Failed to send logout request:', error);
    }

    // Clear local session regardless
    this.clearSession();
  }

  /**
   * Clear session data (logout)
   */
  clearSession(): void {
    console.log('[Auth] Clearing local session data');
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