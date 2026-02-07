'use client';

/**
 * Yellow Network Provider
 *
 * React Context provider for Yellow Network integration.
 * Manages connection, authentication, and unified balance.
 */

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useAccount, useWalletClient } from 'wagmi';
import { YellowClient, type YellowClientState, type UnifiedBalance, ConnectionStatus } from '@/lib/yellow';

interface YellowContextValue {
  client: YellowClient | null;
  state: YellowClientState;
  unifiedBalance: UnifiedBalance | undefined;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  authenticate: () => Promise<void>;
  refreshBalance: () => Promise<void>;
  isConnecting: boolean;
  isAuthenticating: boolean;
  error: string | null;
}

const YellowContext = createContext<YellowContextValue | undefined>(undefined);

export function YellowProvider({ children }: { children: React.ReactNode }) {
  const [client, setClient] = useState<YellowClient | null>(null);
  const [state, setState] = useState<YellowClientState>({ status: ConnectionStatus.DISCONNECTED });
  const [unifiedBalance, setUnifiedBalance] = useState<UnifiedBalance | undefined>();
  const [isConnecting, setIsConnecting] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Wagmi hooks
  const { address, isConnected: isWalletConnected } = useAccount();
  const { data: walletClient } = useWalletClient();

  // Initialize client
  useEffect(() => {
    const yellowClient = new YellowClient({
      wsUrl: process.env.NEXT_PUBLIC_YELLOW_WS_URL,
      autoReconnect: true,
    });

    // Listen to state changes
    yellowClient.on('state_change', (newState: any) => {
      setState(newState as YellowClientState);
      if ((newState as YellowClientState).unifiedBalance) {
        setUnifiedBalance((newState as YellowClientState).unifiedBalance);
      }
    });

    // Listen to errors
    yellowClient.on('error', (errorMsg: any) => {
      const errorText = errorMsg.params?.error || 'Unknown error';
      setError(errorText);
      console.error('Yellow Network error:', errorText);
    });

    setClient(yellowClient);

    return () => {
      yellowClient.disconnect().catch(console.error);
    };
  }, []);

  // Connect to Yellow Network
  const connect = useCallback(async () => {
    if (!client) {
      setError('Client not initialized');
      return;
    }

    try {
      setIsConnecting(true);
      setError(null);
      await client.connect();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to connect';
      setError(errorMsg);
      console.error('Connection error:', err);
      throw err;
    } finally {
      setIsConnecting(false);
    }
  }, [client]);

  // Disconnect from Yellow Network
  const disconnect = useCallback(async () => {
    if (!client) return;

    try {
      await client.disconnect();
      setUnifiedBalance(undefined);
    } catch (err) {
      console.error('Disconnect error:', err);
    }
  }, [client]);

  // Authenticate with Yellow Network
  const authenticate = useCallback(async () => {
    if (!client) {
      setError('Client not initialized');
      return;
    }

    if (!isWalletConnected || !address || !walletClient) {
      setError('Wallet not connected');
      return;
    }

    if (!client.isConnected()) {
      setError('Not connected to Yellow Network');
      return;
    }

    try {
      setIsAuthenticating(true);
      setError(null);

      // Authenticate with the connected wallet
      await client.authenticate(address, walletClient);

      console.log('✅ Authenticated with Yellow Network');
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Authentication failed';
      setError(errorMsg);
      console.error('Authentication error:', err);
      throw err;
    } finally {
      setIsAuthenticating(false);
    }
  }, [client, isWalletConnected, address, walletClient]);

  // Refresh unified balance
  const refreshBalance = useCallback(async () => {
    if (!client || !client.isAuthenticated()) {
      return;
    }

    try {
      const balance = await client.fetchUnifiedBalance();
      setUnifiedBalance(balance);
    } catch (err) {
      console.error('Failed to refresh balance:', err);
    }
  }, [client]);

  // Auto-connect when component mounts (if needed)
  useEffect(() => {
    if (client && state.status === ConnectionStatus.DISCONNECTED) {
      connect().catch(console.error);
    }
  }, [client, state.status, connect]);

  const value: YellowContextValue = {
    client,
    state,
    unifiedBalance,
    connect,
    disconnect,
    authenticate,
    refreshBalance,
    isConnecting,
    isAuthenticating,
    error,
  };

  return (
    <YellowContext.Provider value={value}>
      {children}
    </YellowContext.Provider>
  );
}

// Custom hook to use Yellow Network context
export function useYellow() {
  const context = useContext(YellowContext);
  if (context === undefined) {
    throw new Error('useYellow must be used within a YellowProvider');
  }
  return context;
}

// Helper hooks for common use cases
export function useYellowBalance() {
  const { unifiedBalance, refreshBalance } = useYellow();
  return { balance: unifiedBalance, refreshBalance };
}

export function useYellowConnection() {
  const { state, connect, disconnect, isConnecting } = useYellow();
  return {
    isConnected: state.status === ConnectionStatus.CONNECTED || state.status === ConnectionStatus.AUTHENTICATED,
    isConnecting,
    connect,
    disconnect,
  };
}

export function useYellowAuth() {
  const { state, authenticate, isAuthenticating } = useYellow();
  return {
    isAuthenticated: state.status === ConnectionStatus.AUTHENTICATED,
    isAuthenticating,
    authenticate,
  };
}
