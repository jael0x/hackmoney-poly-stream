/**
 * Channel Management Service for Yellow Network
 * Handles channel lifecycle: create, resize (deposit/withdraw), and close
 */

import {
  createCreateChannelMessage,
  createResizeChannelMessage,
  createCloseChannelMessage,
  NitroliteClient,
  WalletStateSigner
} from '@erc7824/nitrolite';
import type { Address, PublicClient, WalletClient } from 'viem';
import { sepolia } from 'viem/chains';
import { getWebSocketManager, WebSocketManager } from './websocket';
import { getAuthService, AuthService } from './auth';

/**
 * Channel information
 */
export interface ChannelInfo {
  channelId: string;
  balance: bigint;
  lockedBalance: bigint;
  isOpen: boolean;
  participants: Address[];
  chainId: number;
  tokenAddress: Address;
}

/**
 * Channel operation result
 */
export interface ChannelOperationResult {
  success: boolean;
  channelId?: string;
  transactionHash?: string;
  error?: string;
}

/**
 * Channel Manager class
 * Manages Yellow Network payment channels
 */
export class ChannelManager {
  private wsManager: WebSocketManager;
  private authService: AuthService;
  private nitroliteClient: NitroliteClient | null = null;
  private currentChannel: ChannelInfo | null = null;

  constructor(wsManager: WebSocketManager, authService: AuthService) {
    this.wsManager = wsManager;
    this.authService = authService;
  }

  /**
   * Initialize Nitrolite client
   * @param publicClient - Viem public client
   * @param walletClient - Viem wallet client
   */
  initializeClient(publicClient: PublicClient, walletClient: WalletClient): void {
    this.nitroliteClient = new NitroliteClient({
      publicClient: publicClient as any,
      walletClient: walletClient as any,
      stateSigner: new WalletStateSigner(walletClient as any),
      addresses: {
        custody: import.meta.env.VITE_CUSTODY_ADDRESS as Address,
        adjudicator: import.meta.env.VITE_ADJUDICATOR_ADDRESS as Address,
      },
      chainId: sepolia.id,
      challengeDuration: 3600n, // 1 hour challenge period
    });

    console.log('[Channel] Nitrolite client initialized');
  }

  /**
   * Create a new payment channel
   * @param tokenAddress - Address of the token to use in the channel
   * @param initialDeposit - Initial deposit amount (optional)
   * @returns Promise with operation result
   */
  async createChannel(
    tokenAddress: Address = import.meta.env.VITE_TEST_TOKEN_ADDRESS as Address,
    initialDeposit: bigint = 0n
  ): Promise<ChannelOperationResult> {
    console.log('[Channel] Creating new channel...');
    console.log('[Channel] Token:', tokenAddress);
    console.log('[Channel] Initial deposit:', initialDeposit);

    try {
      // Ensure authenticated
      if (!this.authService.isAuthenticated()) {
        throw new Error('Not authenticated. Please authenticate first.');
      }

      // Get session signer
      const sessionSigner = this.authService.getSessionSigner();

      // Create channel message
      const createChannelMsg = await createCreateChannelMessage(
        sessionSigner,
        {
          chain_id: sepolia.id,
          token: tokenAddress,
        }
      );

      return new Promise((resolve, reject) => {
        // Set up response handler
        const responseHandler = async (data: any) => {
          console.log('[Channel] Create channel response:', data);

          try {
            if (data.res[0] === 0) {
              // Error response
              throw new Error(data.res[2]);
            }

            // Extract channel data from response
            const channelData = data.res[2];
            const channelId = channelData.channel_id;
            const channel = channelData.channel;
            const unsignedInitialState = channelData.unsigned_initial_state;
            const serverSignature = channelData.server_signature;

            console.log('[Channel] Channel created on server:', channelId);

            // Submit to blockchain if client is available
            if (this.nitroliteClient) {
              console.log('[Channel] Submitting to blockchain...');

              const createResult = await this.nitroliteClient.createChannel({
                channel,
                unsignedInitialState,
                serverSignature,
              });

              console.log('[Channel] Blockchain transaction:', createResult);

              // Store channel info
              this.currentChannel = {
                channelId,
                balance: initialDeposit,
                lockedBalance: 0n,
                isOpen: true,
                participants: channel.participants,
                chainId: sepolia.id,
                tokenAddress,
              };

              resolve({
                success: true,
                channelId,
                transactionHash: (createResult as any).txHash || (createResult as any).hash,
              });
            } else {
              // No client, just store server channel
              this.currentChannel = {
                channelId,
                balance: initialDeposit,
                lockedBalance: 0n,
                isOpen: true,
                participants: [],
                chainId: sepolia.id,
                tokenAddress,
              };

              resolve({
                success: true,
                channelId,
              });
            }

            // Clean up listener
            this.wsManager.removeListener('create_channel', responseHandler);
          } catch (error: any) {
            console.error('[Channel] Error creating channel:', error);
            reject(error);
          }
        };

        // Register listener
        this.wsManager.once('create_channel', responseHandler);

        // Send create channel message
        this.wsManager.send(JSON.parse(createChannelMsg) as any);

        // Timeout after 30 seconds
        setTimeout(() => {
          this.wsManager.removeListener('create_channel', responseHandler);
          reject(new Error('Create channel timeout'));
        }, 30000);
      });
    } catch (error: any) {
      console.error('[Channel] Create channel error:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Resize channel (deposit or withdraw)
   * @param amount - Amount to deposit (positive) or withdraw (negative)
   * @param fundsDestination - Address to send withdrawn funds to
   * @returns Promise with operation result
   */
  async resizeChannel(
    amount: bigint,
    fundsDestination: Address
  ): Promise<ChannelOperationResult> {
    console.log('[Channel] Resizing channel...');
    console.log('[Channel] Amount:', amount);
    console.log('[Channel] Destination:', fundsDestination);

    try {
      // Ensure we have a channel
      if (!this.currentChannel) {
        throw new Error('No active channel. Please create a channel first.');
      }

      // Ensure authenticated
      if (!this.authService.isAuthenticated()) {
        throw new Error('Not authenticated. Please authenticate first.');
      }

      // Get session signer
      const sessionSigner = this.authService.getSessionSigner();

      // Create resize message
      const resizeMsg = await createResizeChannelMessage(
        sessionSigner,
        {
          channel_id: this.currentChannel.channelId as `0x${string}`,
          allocate_amount: amount,
          funds_destination: fundsDestination,
        }
      );

      return new Promise((resolve, reject) => {
        // Set up response handler
        const responseHandler = async (data: any) => {
          console.log('[Channel] Resize channel response:', data);

          try {
            if (data.res[0] === 0) {
              // Error response
              throw new Error(data.res[2]);
            }

            // Extract resize data from response
            const resizeData = data.res[2];
            const resizeState = resizeData.resize_state;
            const proofStates = resizeData.proof_states;

            console.log('[Channel] Channel resized on server');

            // Submit to blockchain if client is available
            if (this.nitroliteClient) {
              console.log('[Channel] Submitting resize to blockchain...');

              const resizeResult = await this.nitroliteClient.resizeChannel({
                resizeState,
                proofStates,
              });

              console.log('[Channel] Resize transaction:', resizeResult);

              // Update channel balance
              if (this.currentChannel) {
                this.currentChannel.balance += amount;
              }

              resolve({
                success: true,
                channelId: this.currentChannel?.channelId,
                transactionHash: (resizeResult as any).txHash || (resizeResult as any).hash,
              });
            } else {
              // Update channel balance
              if (this.currentChannel) {
                this.currentChannel.balance += amount;
              }

              resolve({
                success: true,
                channelId: this.currentChannel?.channelId,
              });
            }

            // Clean up listener
            this.wsManager.removeListener('resize_channel', responseHandler);
          } catch (error: any) {
            console.error('[Channel] Error resizing channel:', error);
            reject(error);
          }
        };

        // Register listener
        this.wsManager.once('resize_channel', responseHandler);

        // Send resize message
        this.wsManager.send(JSON.parse(resizeMsg) as any);

        // Timeout after 30 seconds
        setTimeout(() => {
          this.wsManager.removeListener('resize_channel', responseHandler);
          reject(new Error('Resize channel timeout'));
        }, 30000);
      });
    } catch (error: any) {
      console.error('[Channel] Resize channel error:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Close the current channel
   * @param recipientAddress - Address to receive final balance
   * @returns Promise with operation result
   */
  async closeChannel(recipientAddress: Address): Promise<ChannelOperationResult> {
    console.log('[Channel] Closing channel...');
    console.log('[Channel] Recipient:', recipientAddress);

    try {
      // Ensure we have a channel
      if (!this.currentChannel) {
        throw new Error('No active channel. Please create a channel first.');
      }

      // Ensure authenticated
      if (!this.authService.isAuthenticated()) {
        throw new Error('Not authenticated. Please authenticate first.');
      }

      // Get session signer
      const sessionSigner = this.authService.getSessionSigner();

      // Create close message
      const closeMsg = await createCloseChannelMessage(
        sessionSigner,
        this.currentChannel.channelId as `0x${string}`,
        recipientAddress
      );

      return new Promise((resolve, reject) => {
        // Set up response handler
        const responseHandler = async (data: any) => {
          console.log('[Channel] Close channel response:', data);

          try {
            if (data.res[0] === 0) {
              // Error response
              throw new Error(data.res[2]);
            }

            // Extract close data from response
            const closeData = data.res[2];
            const finalState = closeData.final_state;
            const stateData = closeData.state_data;

            console.log('[Channel] Channel closed on server');

            // Submit to blockchain if client is available
            if (this.nitroliteClient) {
              console.log('[Channel] Submitting close to blockchain...');

              const closeResult = await this.nitroliteClient.closeChannel({
                finalState,
                stateData,
              });

              console.log('[Channel] Close transaction:', closeResult);

              // Clear current channel
              const channelId = this.currentChannel?.channelId;
              this.currentChannel = null;

              resolve({
                success: true,
                channelId,
                transactionHash: closeResult as any,
              });
            } else {
              // Clear current channel
              const channelId = this.currentChannel?.channelId;
              this.currentChannel = null;

              resolve({
                success: true,
                channelId,
              });
            }

            // Clean up listener
            this.wsManager.removeListener('close_channel', responseHandler);
          } catch (error: any) {
            console.error('[Channel] Error closing channel:', error);
            reject(error);
          }
        };

        // Register listener
        this.wsManager.once('close_channel', responseHandler);

        // Send close message
        this.wsManager.send(JSON.parse(closeMsg) as any);

        // Timeout after 30 seconds
        setTimeout(() => {
          this.wsManager.removeListener('close_channel', responseHandler);
          reject(new Error('Close channel timeout'));
        }, 30000);
      });
    } catch (error: any) {
      console.error('[Channel] Close channel error:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Withdraw funds from custody contract to wallet
   * @param tokenAddress - Token to withdraw
   * @param amount - Amount to withdraw
   * @returns Promise with transaction hash
   */
  async withdrawFromCustody(
    tokenAddress: Address,
    amount: bigint
  ): Promise<string | undefined> {
    if (!this.nitroliteClient) {
      throw new Error('Nitrolite client not initialized');
    }

    console.log('[Channel] Withdrawing from custody...');
    console.log('[Channel] Token:', tokenAddress);
    console.log('[Channel] Amount:', amount);

    const tx = await this.nitroliteClient.withdrawal(tokenAddress, amount);
    console.log('[Channel] Withdrawal transaction:', tx);

    return tx as any;
  }

  /**
   * Get current channel information
   * @returns Current channel info or null
   */
  getCurrentChannel(): ChannelInfo | null {
    return this.currentChannel;
  }

  /**
   * Check if a channel is currently open
   * @returns True if channel is open
   */
  hasOpenChannel(): boolean {
    return this.currentChannel !== null && this.currentChannel.isOpen;
  }
}

// Export singleton instance
let channelManager: ChannelManager | null = null;

/**
 * Get or create channel manager instance
 * @returns Channel manager instance
 */
export function getChannelManager(): ChannelManager {
  if (!channelManager) {
    const wsManager = getWebSocketManager();
    const authService = getAuthService();
    channelManager = new ChannelManager(wsManager, authService);
  }

  return channelManager;
}