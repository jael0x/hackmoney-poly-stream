/**
 * Home Page Component
 * Landing page with wallet connection and quick actions
 */

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAccount, usePublicClient } from 'wagmi';
import { getWalletClient } from 'wagmi/actions';
import { useStore } from '../store';
import { getWebSocketManager } from '../services/websocket';
import { getAuthService } from '../services/auth';
import { getChannelManager } from '../services/channel';
import { wagmiConfig } from '../config/wagmi';

/**
 * Home page component
 * Shows welcome message, wallet status, and quick actions
 */
export const Home: React.FC = () => {
  const navigate = useNavigate();
  const { isConnected, address } = useAccount();
  const publicClient = usePublicClient();
  const { websocket, setWebSocket, auth, setAuth, channel, setChannel, setTransaction } = useStore();
  const [isConnecting, setIsConnecting] = useState(false);
  const [walletClient, setWalletClient] = useState<any>(null);
  const [isWalletClientLoading, setIsWalletClientLoading] = useState(false);

  // Get wallet client when connected
  useEffect(() => {
    const fetchWalletClient = async () => {
      if (isConnected && address) {
        setIsWalletClientLoading(true);
        try {
          const client = await getWalletClient(wagmiConfig, { account: address });
          console.log('[Home] Wallet client fetched:', client);
          setWalletClient(client);
        } catch (error) {
          console.error('[Home] Failed to get wallet client:', error);
          setWalletClient(null);
        } finally {
          setIsWalletClientLoading(false);
        }
      } else {
        setWalletClient(null);
      }
    };

    fetchWalletClient();
  }, [isConnected, address]);

  /**
   * Initialize WebSocket connection
   */
  useEffect(() => {
    const wsManager = getWebSocketManager(import.meta.env.VITE_YELLOW_WS_URL);

    // Connect to WebSocket
    wsManager.connect().then(() => {
      console.log('[Home] WebSocket connected');
      setWebSocket({ isConnected: true });
    }).catch((error) => {
      console.error('[Home] WebSocket connection failed:', error);
      setWebSocket({ isConnected: false, connectionError: error.message });
    });

    // Listen for connection events
    wsManager.on('connected', () => {
      setWebSocket({ isConnected: true, connectionError: undefined });
    });

    wsManager.on('disconnected', () => {
      setWebSocket({ isConnected: false });
    });

    wsManager.on('error', (error) => {
      setWebSocket({ connectionError: error.message });
    });

    // Cleanup
    return () => {
      wsManager.removeAllListeners();
    };
  }, [setWebSocket]);

  /**
   * Connect to Yellow Network
   * Authenticates and creates a channel
   */
  const handleConnectToYellow = async () => {
    // Check if wallet is connected first
    if (!isConnected || !address) {
      alert('Please connect your wallet first');
      return;
    }

    // Check if wallet client is ready
    if (!walletClient) {
      alert('Wallet connection is not ready. Please try reconnecting your wallet.');
      return;
    }

    setIsConnecting(true);
    setTransaction({ isLoading: true, message: 'Connecting to Yellow Network...' });

    try {
      // Check if we're on the correct chain (Sepolia)
      const chainId = await walletClient.getChainId();
      console.log('[Home] Current chain ID:', chainId);

      const SEPOLIA_CHAIN_ID = 11155111;

      if (chainId !== SEPOLIA_CHAIN_ID) {
        console.log('[Home] Wrong chain detected, switching to Sepolia...');
        setTransaction({ isLoading: true, message: 'Switching to Sepolia testnet...' });

        try {
          // Request chain switch
          await walletClient.switchChain({ id: SEPOLIA_CHAIN_ID });
          console.log('[Home] Successfully switched to Sepolia');
        } catch (switchError: any) {
          console.error('[Home] Failed to switch chain:', switchError);

          // If the chain is not added, prompt user to add it
          if (switchError.code === 4902) {
            alert('Please add Sepolia testnet to your wallet and try again.');
          } else {
            alert('Please switch to Sepolia testnet in your wallet to continue.');
          }

          setIsConnecting(false);
          setTransaction({ isLoading: false });
          return;
        }
      }

      // Authenticate
      console.log('[Home] Authenticating...');
      const authService = getAuthService();

      try {
        await authService.authenticate(walletClient, address);

        setAuth({
          isAuthenticated: true,
          sessionKey: authService.getSessionAddress() || undefined,
          sessionExpiry: BigInt(authService.getTimeUntilExpiry()),
        });

        setTransaction({ message: 'Creating channel...' });
      } catch (authError: any) {
        console.error('[Home] Authentication failed:', authError);

        // Handle specific error cases
        if (authError.message?.includes('invalid challenge or signature')) {
          // For invalid signature, offer to force clear and retry
          const shouldRetry = window.confirm(
            'Authentication failed: Invalid signature.\n\n' +
            'This usually happens when there\'s an existing session conflict.\n\n' +
            'Would you like to force clear the session and try again?'
          );

          if (shouldRetry) {
            console.log('[Home] User chose to force clear and retry');
            setTransaction({ isLoading: true, message: 'Clearing session and retrying...' });

            // Force clear and retry with a delay
            const authService = getAuthService();
            await authService.logout();
            await new Promise(resolve => setTimeout(resolve, 1000));

            try {
              // Retry authentication with force flag
              await authService.authenticate(walletClient, address, undefined, true);

              setAuth({
                isAuthenticated: true,
                sessionKey: authService.getSessionAddress() || undefined,
                sessionExpiry: BigInt(authService.getTimeUntilExpiry()),
              });

              setTransaction({ message: 'Creating channel...' });
              // Continue with the flow...
            } catch (retryError: any) {
              console.error('[Home] Retry failed:', retryError);
              alert(`Retry failed: ${retryError.message || 'Unknown error'}`);
              setIsConnecting(false);
              setTransaction({ isLoading: false });
              return;
            }
          } else {
            setIsConnecting(false);
            setTransaction({ isLoading: false });
            return;
          }
        } else if (authError.message?.includes('timeout')) {
          alert('Authentication timed out. Please try again.');
          setIsConnecting(false);
          setTransaction({ isLoading: false });
          return;
        } else {
          alert(`Authentication failed: ${authError.message || 'Unknown error'}`);
          setIsConnecting(false);
          setTransaction({ isLoading: false });
          return;
        }
      }

      // Create channel
      console.log('[Home] Creating channel...');
      const channelManager = getChannelManager();

      // Use publicClient with proper type assertion
      if (!publicClient) {
        throw new Error('Public client not available');
      }

      channelManager.initializeClient(
        publicClient as any,
        walletClient
      );

      const result = await channelManager.createChannel();

      if (result.success) {
        setChannel({
          isOpen: true,
          channelId: result.channelId,
          balance: 0n,
          lockedBalance: 0n,
        });

        setTransaction({
          isLoading: false,
          message: 'Successfully connected to Yellow Network!',
          hash: result.transactionHash
        });

        // Navigate to market after successful connection
        setTimeout(() => {
          navigate('/market');
        }, 2000);
      } else {
        throw new Error(result.error || 'Failed to create channel');
      }
    } catch (error: any) {
      console.error('[Home] Connection failed:', error);
      setTransaction({
        isLoading: false,
        error: error.message || 'Failed to connect to Yellow Network'
      });
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="container mx-auto px-4 py-12">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-green-400 to-blue-500 bg-clip-text text-transparent">
            Nitrolite Prediction Markets
          </h1>
          <p className="text-xl text-gray-300 mb-8">
            Decentralized prediction markets powered by Yellow Network
          </p>

          {/* Demo Notice */}
          <div className="bg-yellow-900/20 border border-yellow-600/30 rounded-lg p-4 max-w-2xl mx-auto mb-8">
            <p className="text-yellow-400 text-sm">
              ⚠️ This is a test implementation on Sepolia testnet.
              All code is thoroughly commented for educational purposes.
            </p>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-4xl mx-auto">
          {/* Connection Status */}
          <div className="bg-gray-900 rounded-lg p-6 mb-8">
            <h2 className="text-2xl font-semibold mb-4">Connection Status</h2>

            <div className="space-y-3">
              {/* Wallet Connection */}
              <div className="flex items-center justify-between p-3 bg-gray-800 rounded">
                <div className="flex items-center space-x-2">
                  <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-gray-500'}`} />
                  <span>Wallet</span>
                </div>
                <span className="text-sm text-gray-400">
                  {isConnected ? `Connected: ${address?.slice(0, 6)}...${address?.slice(-4)}` : 'Not connected'}
                </span>
              </div>

              {/* WebSocket Connection */}
              <div className="flex items-center justify-between p-3 bg-gray-800 rounded">
                <div className="flex items-center space-x-2">
                  <div className={`w-3 h-3 rounded-full ${websocket.isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                  <span>WebSocket</span>
                </div>
                <span className="text-sm text-gray-400">
                  {websocket.isConnected ? 'Connected to Yellow Network' : websocket.connectionError || 'Connecting...'}
                </span>
              </div>

              {/* Authentication */}
              <div className="flex items-center justify-between p-3 bg-gray-800 rounded">
                <div className="flex items-center space-x-2">
                  <div className={`w-3 h-3 rounded-full ${auth.isAuthenticated ? 'bg-green-500' : 'bg-gray-500'}`} />
                  <span>Authentication</span>
                </div>
                <span className="text-sm text-gray-400">
                  {auth.isAuthenticated ? 'Authenticated' : 'Not authenticated'}
                </span>
              </div>

              {/* Channel */}
              <div className="flex items-center justify-between p-3 bg-gray-800 rounded">
                <div className="flex items-center space-x-2">
                  <div className={`w-3 h-3 rounded-full ${channel.isOpen ? 'bg-green-500' : 'bg-gray-500'}`} />
                  <span>Payment Channel</span>
                </div>
                <span className="text-sm text-gray-400">
                  {channel.isOpen ? `Open: ${channel.channelId?.slice(0, 8)}...` : 'No channel'}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-gray-900 rounded-lg p-6">
            <h2 className="text-2xl font-semibold mb-4">Quick Actions</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Connect to Yellow */}
              {!channel.isOpen && (
                <button
                  onClick={handleConnectToYellow}
                  disabled={!isConnected || !websocket.isConnected || isConnecting || isWalletClientLoading || !walletClient}
                  className="p-4 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 disabled:from-gray-600 disabled:to-gray-700 rounded-lg transition-all"
                >
                  <div className="flex items-center justify-center space-x-2">
                    <span className="text-2xl">🔗</span>
                    <div className="text-left">
                      <p className="font-semibold">Connect to Yellow Network</p>
                      <p className="text-sm opacity-80">
                        {isConnecting ? 'Connecting...' :
                         isWalletClientLoading ? 'Preparing wallet...' :
                         !walletClient ? 'Wallet not ready' :
                         'Authenticate & create channel'}
                      </p>
                    </div>
                  </div>
                </button>
              )}

              {/* Go to Market */}
              <button
                onClick={() => navigate('/market')}
                disabled={!channel.isOpen}
                className="p-4 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:from-gray-600 disabled:to-gray-700 rounded-lg transition-all"
              >
                <div className="flex items-center justify-center space-x-2">
                  <span className="text-2xl">📊</span>
                  <div className="text-left">
                    <p className="font-semibold">View Market</p>
                    <p className="text-sm opacity-80">Place predictions</p>
                  </div>
                </div>
              </button>

              {/* Deposit Funds */}
              <button
                disabled={!channel.isOpen}
                className="p-4 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 disabled:from-gray-600 disabled:to-gray-700 rounded-lg transition-all"
              >
                <div className="flex items-center justify-center space-x-2">
                  <span className="text-2xl">💰</span>
                  <div className="text-left">
                    <p className="font-semibold">Deposit Funds</p>
                    <p className="text-sm opacity-80">Add USDC to channel</p>
                  </div>
                </div>
              </button>

              {/* Admin Panel */}
              <button
                onClick={() => navigate('/admin')}
                className="p-4 bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800 rounded-lg transition-all"
              >
                <div className="flex items-center justify-center space-x-2">
                  <span className="text-2xl">⚙️</span>
                  <div className="text-left">
                    <p className="font-semibold">Admin Panel</p>
                    <p className="text-sm opacity-80">Manage markets</p>
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* Instructions */}
          <div className="mt-8 bg-gray-900 rounded-lg p-6">
            <h2 className="text-2xl font-semibold mb-4">How to Use</h2>
            <ol className="space-y-2 text-gray-300">
              <li>1. Connect your MetaMask wallet to Sepolia testnet</li>
              <li>2. Click "Connect to Yellow Network" to authenticate</li>
              <li>3. Deposit test USDC into your payment channel</li>
              <li>4. Navigate to the Market page to place predictions</li>
              <li>5. Use the Admin panel to create or resolve markets</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
};