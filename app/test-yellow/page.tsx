
"use client";

import { Navbar } from '@/components/navbar';
/**
 * Test Page for Yellow Network Connection
 * Simple test to verify yellow-ts works
 */

import { wagmiConfig } from '@/lib/yellow/wagmi';
import { getYellowClient } from '@/lib/yellow/yellow-client';
import { useState } from 'react';
import { useAccount } from 'wagmi';
import { getWalletClient } from '@wagmi/core';

declare global {
  interface Window {
    ethereum?: any;
  }
}

export default function TestYellow() {
  const { isConnected, address } = useAccount();
  const [status, setStatus] = useState<string>('Not started');
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (msg: string) => {
    console.log(msg);
    setLogs(prev => [...prev, `${new Date().toLocaleTimeString()}: ${msg}`]);
  };

  const testConnection = async () => {
    if (!isConnected || !address) {
      addLog('ERROR: Wallet not connected');
      return;
    }

    setStatus('Testing...');
    setLogs([]);

    try {
      // Step 1: Connect to Yellow Network
      addLog('Step 1: Connecting to Yellow Network...');
      const yellowClient = getYellowClient();
      await yellowClient.connect();
      addLog('✅ Connected to Yellow Network!');

      // Step 2: Get wallet client
      addLog('Step 2: Getting wallet client...');
      const walletClient = await getWalletClient(wagmiConfig, { account: address });
      if (!walletClient) {
        throw new Error('Failed to get wallet client');
      }
      addLog('✅ Wallet client ready');

      // Step 3: Authenticate
      addLog('Step 3: Authenticating...');
      addLog('(MetaMask should open for signature)');
      await yellowClient.authenticate(walletClient, address);
      addLog('✅ Authenticated!');

      const state = yellowClient.getState();
      addLog(`Session key: ${state.sessionKey}`);
      addLog(`Expires: ${state.sessionExpiry ? new Date(state.sessionExpiry * 1000).toLocaleString() : 'N/A'}`);

      setStatus('SUCCESS! 🎉');
    } catch (error: unknown) {
      if (error instanceof Error) {
        addLog(`❌ ERROR: ${error.message}`);
      } else {
        addLog(`❌ ERROR: ${String(error)}`);
      }
      setStatus('FAILED');
      console.error('Full error:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950">
      <Navbar />
      <div className="min-h-screen bg-gray-950 text-white p-8">
        <h1 className="text-3xl font-bold mb-6">Yellow Network Test</h1>

        <div className="mb-6">
          <p>Wallet: {isConnected ? `${address?.slice(0, 10)}...` : 'Not connected'}</p>
          <p>Status: <span className={status === 'SUCCESS! 🎉' ? 'text-green-500' : status === 'FAILED' ? 'text-red-500' : 'text-yellow-500'}>{status}</span></p>
        </div>

        <button
          onClick={testConnection}
          disabled={!isConnected}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 rounded-lg font-semibold mb-6"
        >
          Test Yellow Connection
        </button>

        <div className="bg-gray-900 rounded-lg p-4">
          <h2 className="text-xl font-semibold mb-3">Logs:</h2>
          <div className="font-mono text-sm space-y-1 max-h-96 overflow-y-auto">
            {logs.length === 0 ? (
              <p className="text-gray-500">Click the button to start test...</p>
            ) : (
              logs.map((log, i) => (
                <p key={i} className={log.includes('ERROR') || log.includes('❌') ? 'text-red-400' : log.includes('✅') ? 'text-green-400' : 'text-gray-300'}>
                  {log}
                </p>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
