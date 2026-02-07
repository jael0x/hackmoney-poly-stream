"use client";

import { Navbar } from '@/components/navbar';
import { wagmiConfig } from '@/lib/yellow/wagmi';
import { YellowClient, ConnectionStatus } from '@/lib/yellow/client';
import { useState, useEffect, useRef } from 'react';
import { useAccount } from 'wagmi';
import { getWalletClient } from '@wagmi/core';
import type { Hex, Address } from 'viem';

declare global {
  interface Window {
    ethereum?: any;
  }
}

export default function TestYellow() {
  const { isConnected, address } = useAccount();
  const [status, setStatus] = useState<string>('Not started');
  const [logs, setLogs] = useState<string[]>([]);
  const [ledgerBalance, setLedgerBalance] = useState<string>('0');
  const [appSessions, setAppSessions] = useState<any[]>([]);
  const [testMarketId, setTestMarketId] = useState<string>('');
  const yellowClientRef = useRef<YellowClient | null>(null);

  useEffect(() => {
    // Cleanup on unmount
    return () => {
      if (yellowClientRef.current) {
        yellowClientRef.current.disconnect();
      }
    };
  }, []);

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
      // Step 1: Get wallet client
      addLog('Step 1: Getting wallet client...');
      const walletClient = await getWalletClient(wagmiConfig, { account: address as `0x${string}` });
      if (!walletClient) {
        throw new Error('Failed to get wallet client');
      }
      addLog('✅ Wallet client ready');

      // Step 2: Create Yellow client with wallet signer
      addLog('Step 2: Creating Yellow client...');
      const yellowClient = new YellowClient();
      yellowClientRef.current = yellowClient;
      addLog('✅ Yellow client created');

      // Step 3: Connect with wallet
      addLog('Step 3: Connecting to Yellow Network...');
      await yellowClient.connect();
      addLog('✅ Connected to Yellow Network');

      // Step 4: Authenticate with wallet
      addLog('Step 4: Authenticating with wallet...');
      await yellowClient.authenticate(address as Hex, walletClient as any);
      addLog('✅ Authenticated!');

      // Step 5: Get session info
      const sessionKeys = await yellowClient.getSessionKeys();
      addLog(`Step 5: Session keys: ${sessionKeys.length > 0 ? sessionKeys[0].session_key.slice(0, 10) + '...' : 'N/A'}`);

      // Step 6: Check balances
      addLog('Step 6: Fetching balance...');

      // Get ledger balance (your actual Yellow Network balance)
      const ledgerBalances = yellowClient.getLedgerBalance();
      console.log('Ledger balances:', ledgerBalances);

      // Extract ytest.usd balance
      let balance = '0';
      if (ledgerBalances && ledgerBalances.length > 0) {
        const ytestBalance = ledgerBalances.find((b: any) => b.asset === 'ytest.usd');
        if (ytestBalance) {
          balance = ytestBalance.amount || '0';
        }
      }

      setLedgerBalance(balance);
      addLog(`Ledger balance: ${balance} ytest.usd`);

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

  const createTestMarket = async () => {
    if (!yellowClientRef.current) {
      addLog('ERROR: Client not initialized');
      return;
    }

    try {
      addLog('Creating test prediction market...');

      // Create a simple test market
      const appSessionId = await yellowClientRef.current.createAppSession({
        definition: {
          protocol: 'NitroRPC/0.4',
          participants: ['0x0000000000000000000000000000000000000001', '0x0000000000000000000000000000000000000002', address] as [string, string, string],
          weights: [0, 0, 100],
          quorum: 100,
          challenge: 3600,
          nonce: Math.floor(Math.random() * 1000000)
        },
        allocations: [
          {
            participant: '0x0000000000000000000000000000000000000001' as Address, // YES pool
            amount: '0',
            asset: 'ytest.usd'
          },
          {
            participant: '0x0000000000000000000000000000000000000002' as Address, // NO pool
            amount: '0',
            asset: 'ytest.usd'
          }
        ]
      });

      setTestMarketId(appSessionId);
      addLog(`✅ Test market created! Session ID: ${appSessionId}`);

      // Refresh sessions
      await fetchAppSessions();
    } catch (error) {
      addLog(`❌ Error creating market: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const placeBet = async (position: 'yes' | 'no') => {
    if (!yellowClientRef.current || !testMarketId) {
      addLog('ERROR: Client not initialized or no market created');
      return;
    }

    try {
      const amount = '1000000'; // 1 ytest.usd (6 decimals)
      const poolAddress = position === 'yes'
        ? '0x0000000000000000000000000000000000000001'
        : '0x0000000000000000000000000000000000000002';

      addLog(`Placing ${position.toUpperCase()} bet of 1 ytest.usd...`);

      // Get current allocations
      const sessions = await yellowClientRef.current.getAppSessions(address as Address);
      const session = sessions.find((s: any) => s.app_session_id === testMarketId);
      const currentAllocations = session?.allocations || [];

      // Submit bet
      await yellowClientRef.current.submitBet(
        testMarketId as Hex,
        poolAddress as Address,
        'ytest.usd',
        amount,
        currentAllocations
      );

      addLog(`✅ Bet placed on ${position.toUpperCase()}!`);

      // Refresh balance and sessions
      const ledgerBalances = yellowClientRef.current.getLedgerBalance();
      let balance = '0';
      if (ledgerBalances && ledgerBalances.length > 0) {
        const ytestBalance = ledgerBalances.find((b: any) => b.asset === 'ytest.usd');
        if (ytestBalance) {
          balance = ytestBalance.amount || '0';
        }
      }
      setLedgerBalance(balance);

      await fetchAppSessions();
    } catch (error) {
      addLog(`❌ Error placing bet: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const fetchAppSessions = async () => {
    if (!yellowClientRef.current || !address) {
      addLog('ERROR: Client not initialized');
      return;
    }

    try {
      addLog('Fetching app sessions...');
      const sessions = await yellowClientRef.current.getAppSessions(address as Address, 'open');
      setAppSessions(sessions);
      addLog(`Found ${sessions.length} active app sessions`);

      // Log session details
      sessions.forEach((session: any) => {
        console.log('Session:', session);
        const totalLocked = session.allocations?.reduce((sum: bigint, alloc: any) =>
          sum + BigInt(alloc.amount || 0), 0n) || 0n;
        addLog(`  - Session ${session.app_session_id?.slice(0, 10)}... | Locked: ${totalLocked.toString()} ytest.usd`);
      });
    } catch (error) {
      addLog(`❌ Error fetching sessions: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const closeTestMarket = async () => {
    if (!yellowClientRef.current || !testMarketId) {
      addLog('ERROR: Client not initialized or no market to close');
      return;
    }

    try {
      addLog('Closing test market...');

      // Get current session state
      const sessions = await yellowClientRef.current.getAppSessions(address as Address);
      const session = sessions.find((s: any) => s.app_session_id === testMarketId);

      if (!session) {
        throw new Error('Session not found');
      }

      // For testing, distribute all funds back to the user
      const totalAmount = session.allocations?.reduce((sum: bigint, alloc: any) =>
        sum + BigInt(alloc.amount || 0), 0n) || 0n;

      const finalAllocations = [{
        participant: address as Address,
        amount: totalAmount.toString(),
        asset: 'ytest.usd'
      }];

      await yellowClientRef.current.closeAppSession(
        testMarketId as Hex,
        finalAllocations
      );

      addLog(`✅ Market closed! Funds returned to wallet.`);
      setTestMarketId('');

      // Refresh balance and sessions
      const ledgerBalances = yellowClientRef.current.getLedgerBalance();
      let balance = '0';
      if (ledgerBalances && ledgerBalances.length > 0) {
        const ytestBalance = ledgerBalances.find((b: any) => b.asset === 'ytest.usd');
        if (ytestBalance) {
          balance = ytestBalance.amount || '0';
        }
      }
      setLedgerBalance(balance);

      await fetchAppSessions();
    } catch (error) {
      addLog(`❌ Error closing market: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  return (
    <div className="bg-gray-900 text-white">
      <Navbar />
      <h1 className="text-4xl font-bold text-center pt-8 bg-gray-900 text-white">Yellow Network - Prediction Market Test</h1>
      <div className="min-h-screen bg-gray-900 text-white flex flex-row p-8 gap-4">
        <div className="container">

          <div className="mb-8 bg-gray-800 rounded-lg p-6">
            <h2 className="text-2xl font-semibold mb-4">Connection Test</h2>

            <div className="mb-6 space-y-2">
              <p>Wallet: {isConnected ? `${address?.slice(0, 10)}...` : 'Not connected'}</p>
              <p>Status: <span className={status === 'SUCCESS! 🎉' ? 'text-green-500' : status === 'FAILED' ? 'text-red-500' : 'text-yellow-500'}>{status}</span></p>
              <p>Ledger Balance: {ledgerBalance} ytest.usd</p>
            </div>

            <div className="space-x-4 mb-6">
              <button
                onClick={testConnection}
                disabled={!isConnected}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 rounded"
              >
                Test Connection
              </button>
              <button
                onClick={fetchAppSessions}
                disabled={!yellowClientRef.current}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 rounded"
              >
                Refresh Sessions
              </button>
            </div>
          </div>

          <div className="mb-8 bg-gray-800 rounded-lg p-6">
            <h2 className="text-2xl font-semibold mb-4">Market Operations</h2>

            <div className="space-y-4">
              <div>
                <button
                  onClick={createTestMarket}
                  disabled={!yellowClientRef.current || !!testMarketId}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 rounded mr-4"
                >
                  Create Test Market
                </button>
                {testMarketId && (
                  <span className="text-sm text-gray-400">
                    Active Market: {testMarketId.slice(0, 10)}...
                  </span>
                )}
              </div>

              <div className="flex space-x-4">
                <button
                  onClick={() => placeBet('yes')}
                  disabled={!yellowClientRef.current || !testMarketId}
                  className="px-4 py-2 bg-green-500 hover:bg-green-600 disabled:bg-gray-600 rounded"
                >
                  Bet YES (1 ytest.usd)
                </button>
                <button
                  onClick={() => placeBet('no')}
                  disabled={!yellowClientRef.current || !testMarketId}
                  className="px-4 py-2 bg-red-500 hover:bg-red-600 disabled:bg-gray-600 rounded"
                >
                  Bet NO (1 ytest.usd)
                </button>
              </div>

              <div>
                <button
                  onClick={closeTestMarket}
                  disabled={!yellowClientRef.current || !testMarketId}
                  className="px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-600 rounded"
                >
                  Close Market & Return Funds
                </button>
              </div>
            </div>
          </div>

          <div className="mb-8 bg-gray-800 rounded-lg p-6">
            <h2 className="text-2xl font-semibold mb-4">Active App Sessions</h2>

            {appSessions.length === 0 ? (
              <p className="text-gray-400">No active sessions</p>
            ) : (
              <div className="space-y-2">
                {appSessions.map((session: any, idx: number) => {
                  const totalLocked = session.allocations?.reduce((sum: bigint, alloc: any) =>
                    sum + BigInt(alloc.amount || 0), 0n) || 0n;

                  return (
                    <div key={idx} className="bg-gray-700 p-3 rounded">
                      <p className="text-sm">
                        Session: {session.app_session_id?.slice(0, 20)}...
                      </p>
                      <p className="text-sm text-gray-400">
                        Locked: {totalLocked.toString()} ytest.usd
                      </p>
                      {session.allocations?.map((alloc: any, allocIdx: number) => (
                        <p key={allocIdx} className="text-xs text-gray-500 ml-4">
                          {alloc.participant?.slice(0, 10)}...: {alloc.amount} {alloc.asset}
                        </p>
                      ))}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="container">
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-2xl font-semibold mb-4">Logs</h2>

            <div className="bg-black p-4 rounded h-64 overflow-y-auto font-mono text-sm">
              {logs.length === 0 ? (
                <p className="text-gray-500">No logs yet...</p>
              ) : (
                logs.map((log, idx) => (
                  <div key={idx} className="mb-1">{log}</div>
                ))
              )}
            </div>
          </div>

          <div className="mt-8 p-4 bg-blue-900/30 rounded-lg border border-blue-700">
            <h3 className="text-lg font-semibold mb-2">How Yellow Network Prediction Markets Work:</h3>
            <ol className="list-decimal list-inside space-y-1 text-sm">
              <li>Connect & authenticate with your wallet</li>
              <li>Create a market (creates an app session with YES/NO pools)</li>
              <li>Place bets (locks funds in the app session)</li>
              <li>Close the market (distributes winnings back to participants)</li>
            </ol>
            <p className="text-sm text-gray-400 mt-2">
              Note: Your ledger balance = wallet balance. Funds are locked in app sessions when betting.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}