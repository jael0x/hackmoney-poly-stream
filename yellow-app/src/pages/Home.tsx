/**
 * Home Page Component
 * Landing page with wallet connection and Yellow Network integration
 */

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAccount } from 'wagmi';
import { getWalletClient } from 'wagmi/actions';
import { useStore } from '../store';
import { getYellowClient, YellowClientState } from '../services/yellow-client';
import { wagmiConfig } from '../config/wagmi';

export const Home: React.FC = () => {
  const navigate = useNavigate();
  const { isConnected, address } = useAccount();
  const { auth, setAuth, channel, setChannel, setTransaction } = useStore();

  const [isConnecting, setIsConnecting] = useState(false);
  const [walletClient, setWalletClient] = useState<any>(null);
  const [isWalletClientLoading, setIsWalletClientLoading] = useState(false);
  const [yellowState, setYellowState] = useState<YellowClientState>({
    isConnected: false,
    isAuthenticated: false,
    sessionKey: null,
    sessionExpiry: null,
  });
  const [connectionStatus, setConnectionStatus] = useState<string>('Disconnected');

  // Get wallet client when connected
  useEffect(() => {
    const fetchWalletClient = async () => {
      if (isConnected && address) {
        setIsWalletClientLoading(true);
        try {
          const client = await getWalletClient(wagmiConfig, { account: address });
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

  // Initialize Yellow Network connection on mount
  useEffect(() => {
    const initYellow = async () => {
      try {
        setConnectionStatus('Connecting...');
        const yellowClient = getYellowClient();
        await yellowClient.connect();
        setConnectionStatus('Connected');
        setYellowState(prev => ({ ...prev, isConnected: true }));
      } catch (error: any) {
        console.error('[Home] Yellow connection failed:', error);
        setConnectionStatus(`Error: ${error.message}`);
      }
    };
    initYellow();
  }, []);

  /**
   * Connect and authenticate with Yellow Network
   */
  const handleConnectToYellow = async () => {
    if (!isConnected || !address) {
      alert('Please connect your wallet first');
      return;
    }

    if (!walletClient) {
      alert('Wallet connection is not ready. Please try reconnecting your wallet.');
      return;
    }

    setIsConnecting(true);
    setTransaction({ isLoading: true, message: 'Connecting to Yellow Network...' });

    try {
      // Check chain
      const chainId = await walletClient.getChainId();
      const SEPOLIA_CHAIN_ID = 11155111;

      if (chainId !== SEPOLIA_CHAIN_ID) {
        setTransaction({ isLoading: true, message: 'Switching to Sepolia...' });
        try {
          await walletClient.switchChain({ id: SEPOLIA_CHAIN_ID });
        } catch (switchError: any) {
          alert('Please switch to Sepolia testnet in your wallet.');
          setIsConnecting(false);
          setTransaction({ isLoading: false });
          return;
        }
      }

      // Authenticate with Yellow Network
      setTransaction({ isLoading: true, message: 'Authenticating with Yellow Network...' });

      const yellowClient = getYellowClient();
      await yellowClient.authenticate(walletClient, address);

      const state = yellowClient.getState();
      setYellowState(state);

      setAuth({
        isAuthenticated: true,
        sessionKey: state.sessionKey || undefined,
        sessionExpiry: state.sessionExpiry ? BigInt(state.sessionExpiry) : undefined,
      });

      // For now, mark channel as open after auth (channel creation will be added later)
      setChannel({
        isOpen: true,
        channelId: 'authenticated',
        balance: 0n,
        lockedBalance: 0n,
      });

      setTransaction({
        isLoading: false,
        message: 'Successfully connected to Yellow Network!',
      });

      // Navigate to market
      setTimeout(() => navigate('/market'), 1500);

    } catch (error: any) {
      console.error('[Home] Connection failed:', error);
      setTransaction({
        isLoading: false,
        error: error.message || 'Failed to connect',
      });
      alert(`Connection failed: ${error.message}`);
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

          <div className="bg-yellow-900/20 border border-yellow-600/30 rounded-lg p-4 max-w-2xl mx-auto mb-8">
            <p className="text-yellow-400 text-sm">
              Sepolia Testnet - Using yellow-ts SDK
            </p>
          </div>
        </div>

        <div className="max-w-4xl mx-auto">
          {/* Connection Status */}
          <div className="bg-gray-900 rounded-lg p-6 mb-8">
            <h2 className="text-2xl font-semibold mb-4">Connection Status</h2>

            <div className="space-y-3">
              {/* Wallet */}
              <div className="flex items-center justify-between p-3 bg-gray-800 rounded">
                <div className="flex items-center space-x-2">
                  <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-gray-500'}`} />
                  <span>Wallet</span>
                </div>
                <span className="text-sm text-gray-400">
                  {isConnected ? `${address?.slice(0, 6)}...${address?.slice(-4)}` : 'Not connected'}
                </span>
              </div>

              {/* Yellow Network */}
              <div className="flex items-center justify-between p-3 bg-gray-800 rounded">
                <div className="flex items-center space-x-2">
                  <div className={`w-3 h-3 rounded-full ${yellowState.isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                  <span>Yellow Network</span>
                </div>
                <span className="text-sm text-gray-400">{connectionStatus}</span>
              </div>

              {/* Authentication */}
              <div className="flex items-center justify-between p-3 bg-gray-800 rounded">
                <div className="flex items-center space-x-2">
                  <div className={`w-3 h-3 rounded-full ${yellowState.isAuthenticated || auth.isAuthenticated ? 'bg-green-500' : 'bg-gray-500'}`} />
                  <span>Authentication</span>
                </div>
                <span className="text-sm text-gray-400">
                  {yellowState.isAuthenticated || auth.isAuthenticated
                    ? `Session: ${yellowState.sessionKey?.slice(0, 8)}...`
                    : 'Not authenticated'}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-gray-900 rounded-lg p-6">
            <h2 className="text-2xl font-semibold mb-4">Quick Actions</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Connect to Yellow */}
              {!auth.isAuthenticated && (
                <button
                  onClick={handleConnectToYellow}
                  disabled={!isConnected || !yellowState.isConnected || isConnecting || isWalletClientLoading}
                  className="p-4 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 disabled:from-gray-600 disabled:to-gray-700 rounded-lg transition-all"
                >
                  <div className="flex items-center justify-center space-x-2">
                    <span className="text-2xl">🔗</span>
                    <div className="text-left">
                      <p className="font-semibold">Connect to Yellow Network</p>
                      <p className="text-sm opacity-80">
                        {isConnecting ? 'Connecting...' :
                         isWalletClientLoading ? 'Preparing wallet...' :
                         !yellowState.isConnected ? 'WebSocket connecting...' :
                         'Authenticate with signature'}
                      </p>
                    </div>
                  </div>
                </button>
              )}

              {/* Already Connected */}
              {auth.isAuthenticated && (
                <div className="p-4 bg-green-900/30 border border-green-600/30 rounded-lg">
                  <div className="flex items-center justify-center space-x-2">
                    <span className="text-2xl">✅</span>
                    <div className="text-left">
                      <p className="font-semibold text-green-400">Connected!</p>
                      <p className="text-sm text-green-300">Ready to use Yellow Network</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Go to Market */}
              <button
                onClick={() => navigate('/market')}
                className="p-4 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 rounded-lg transition-all"
              >
                <div className="flex items-center justify-center space-x-2">
                  <span className="text-2xl">📊</span>
                  <div className="text-left">
                    <p className="font-semibold">View Market</p>
                    <p className="text-sm opacity-80">Place predictions</p>
                  </div>
                </div>
              </button>

              {/* Test Page */}
              <button
                onClick={() => navigate('/test')}
                className="p-4 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 rounded-lg transition-all"
              >
                <div className="flex items-center justify-center space-x-2">
                  <span className="text-2xl">🧪</span>
                  <div className="text-left">
                    <p className="font-semibold">Test Connection</p>
                    <p className="text-sm opacity-80">Debug Yellow Network</p>
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
              <li>1. Connect your MetaMask wallet (Sepolia testnet)</li>
              <li>2. Click "Connect to Yellow Network" to authenticate</li>
              <li>3. Sign the message in MetaMask</li>
              <li>4. Navigate to Market to place predictions</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
};
