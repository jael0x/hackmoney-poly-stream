"use client";

import { Navbar } from '@/components/navbar';
import { wagmiConfig } from '@/lib/yellow/wagmi';
import { YellowClient } from '@/lib/yellow/client';
import { useState, useEffect, useRef } from 'react';
import { useAccount } from 'wagmi';
import { getWalletClient } from '@wagmi/core';
import type { Hex, Address } from 'viem';
import { formatAddress } from '@/lib/utils';
import { InlineMarketOperations } from '@/components/inline-market-operations';

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
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
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

  const authenticate = async () => {
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
      try {
        await yellowClient.authenticate(address as Hex, walletClient as any);

        // Verify authentication was successful
        const connectionState = yellowClient.getState();
        if (connectionState.status !== 'authenticated') {
          throw new Error(`Authentication incomplete - status is ${connectionState.status}, expected 'authenticated'`);
        }

        addLog('✅ Authenticated successfully!');
        addLog(`   Session status: ${connectionState.status}`);

      } catch (authError: any) {
        addLog(`❌ Authentication failed: ${authError.message}`);

        // Clean up on auth failure
        yellowClient.disconnect();
        yellowClientRef.current = null;

        setStatus('Authentication Failed');
        return; // Stop here, don't continue with other steps
      }

      // Step 5: Get session info (with error handling)
      try {
        const sessionKeys = await yellowClient.getSessionKeys();
        addLog(`Step 5: Session keys: ${sessionKeys.length > 0 ? sessionKeys[0].session_key.slice(0, 10) + '...' : 'N/A'}`);
      } catch (error: any) {
        addLog(`⚠️ Step 5: Could not get session keys: ${error.message}`);
        // Continue anyway, this is not critical
      }

      // Step 6: Fetch balance (with error handling)
      addLog('Step 6: Fetching balance...');
      let ledgerBalances: any[] = [];
      try {
        const unifiedBalance = await yellowClient.fetchUnifiedBalance();
        ledgerBalances = unifiedBalance.balances || [];
      } catch (error: any) {
        addLog(`⚠️ Step 6: Could not fetch balance: ${error.message}`);
        // Continue anyway, balance will be 0
      }

      // Log all balances for debugging
      if (ledgerBalances.length > 0) {
        addLog(`Found ${ledgerBalances.length} balance entries:`);
        ledgerBalances.forEach((b: any) => {
          addLog(`  - ${b.asset}: ${b.amount} units`);
        });
      } else {
        addLog('⚠️ No balances found. You may need ytest.usd tokens from a faucet.');
      }

      // Extract ytest.usd balance
      let balance = '0';
      if (ledgerBalances && ledgerBalances.length > 0) {
        const ytestBalance = ledgerBalances.find((b: any) => b.asset === 'ytest.usd');
        if (ytestBalance) {
          balance = ytestBalance.amount || '0';
        }
      }

      setLedgerBalance(balance);
      addLog(`✅ Ledger balance: ${balance} ytest.usd (${Number(balance) / 1000000} tokens)`);

      // Step 7: Refresh app sessions (with error handling)
      addLog('Step 7: Refreshing app sessions...');
      try {
        const sessions = await yellowClient.getAppSessions(address, 'open');
        addLog(`✅ Found ${sessions.length} active app sessions`);

        if (sessions.length > 0) {
          console.log('Active sessions:', sessions);
          setAppSessions(sessions); // Update the state with the fetched sessions
        }
      } catch (error: any) {
        addLog(`⚠️ Step 7: Could not fetch app sessions: ${error.message}`);
        // Continue anyway, sessions list will be empty
      }

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
      // Check authentication status first
      const authDetails = yellowClientRef.current.getAuthDetails();
      addLog('🔍 Pre-market creation auth check:');
      addLog(`  - Authenticated: ${authDetails.isAuthenticated}`);
      addLog(`  - Status: ${authDetails.status}`);
      addLog(`  - Has session signer: ${authDetails.hasSessionSigner}`);

      if (!authDetails.isAuthenticated) {
        addLog('❌ Not authenticated! Please authenticate first.');
        return;
      }

      addLog('Creating test prediction market...');

      // Check user's current balance
      const hasBalance = await yellowClientRef.current.hasBalance('ytest.usd', '1000000'); // Check for at least 1 ytest.usd
      let initialAmount = '0';

      if (hasBalance) {
        // Use a smaller amount - 1 ytest.usd (1000000 units)
        initialAmount = '1000000';
        addLog(`Using ${initialAmount} units (1 ytest.usd) for initial market allocation`);
      } else {
        addLog('Warning: No ytest.usd balance available, creating market with 0 initial allocation');
      }

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
          },
          {
            participant: address as Address, // User with initial balance
            amount: initialAmount, // Use available balance or 0
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
        console.log('Full Session Object:', {
          appSessionId: session.appSessionId || session.app_session_id,
          application: session.application,
          protocol: session.protocol,
          version: session.version,
          status: session.status,
          participants: session.participants,
          weights: session.weights,
          quorum: session.quorum,
          challenge: session.challenge,
          nonce: session.nonce,
          createdAt: session.createdAt,
          updatedAt: session.updatedAt,
          allocations: session.allocations,
          sessionData: session.sessionData
        });

        const totalLocked = session.allocations?.reduce((sum: bigint, alloc: any) =>
          sum + BigInt(alloc.amount || 0), 0n) || 0n;
        const sessionId = session.appSessionId || session.app_session_id;
        addLog(`  - Session ${sessionId?.slice(0, 10)}... | Status: ${session.status} | Locked: ${totalLocked.toString()} ytest.usd`);
      });
    } catch (error) {
      addLog(`❌ Error fetching sessions: ${error instanceof Error ? error.message : String(error)}`);
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
              <p>Wallet: {mounted && isConnected ? formatAddress(address) : 'Not connected'}</p>
              <p>Status: <span className={status === 'SUCCESS! 🎉' ? 'text-green-500' : status === 'FAILED' ? 'text-red-500' : 'text-yellow-500'}>{status}</span></p>
              <p>Balance: {ledgerBalance} ytest.usd ({Number(ledgerBalance) / 1000000} tokens)</p>
              {ledgerBalance === '0' && status === 'SUCCESS! 🎉' && (
                <div className="bg-yellow-900/50 border border-yellow-600 rounded p-3 text-sm">
                  <p className="font-semibold">⚠️ No ytest.usd balance detected</p>
                  <p className="mt-1">To create markets and place bets, you need ytest.usd tokens from the Yellow Network testnet faucet.</p>
                  <p className="mt-1">Markets can still be created with 0 initial allocation for testing.</p>
                </div>
              )}
            </div>

            <div className="space-x-4 mb-3 flex flex-row">
              <button
                onClick={authenticate}
                disabled={!mounted || !isConnected}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 rounded"
              >
                Authenticate
              </button>
              <button
                onClick={createTestMarket}
                disabled={!mounted || !yellowClientRef.current || !!testMarketId}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 rounded mr-4"
              >
                Create Market
              </button>
              <button
                onClick={fetchAppSessions}
                disabled={!mounted || !yellowClientRef.current}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 rounded"
              >
                Refresh Sessions
              </button>
            </div>
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

        <div className="container">
          <div className="mb-8 bg-gray-800 rounded-lg p-6">
            <h2 className="text-2xl font-semibold mb-4">Active App Sessions (Markets)</h2>

            {appSessions.length === 0 ? (
              <p className="text-gray-400">No active sessions</p>
            ) : (
              <div className="space-y-4">
                {appSessions.map((session: any, idx: number) => {
                  const totalLocked = session.allocations?.reduce((sum: bigint, alloc: any) =>
                    sum + BigInt(alloc.amount || 0), 0n) || 0n;

                  // Calculate YES/NO pools if available
                  const yesPool = session.allocations?.find((a: any) =>
                    a.participant === '0x0000000000000000000000000000000000000001'
                  );
                  const noPool = session.allocations?.find((a: any) =>
                    a.participant === '0x0000000000000000000000000000000000000002'
                  );

                  const sessionId = session.appSessionId || session.app_session_id;
                  const isActiveMarket = sessionId === testMarketId;

                  return (
                    <div key={idx} className={`bg-gray-700 rounded-lg overflow-hidden border-2 transition-colors ${isActiveMarket ? 'border-yellow-400 shadow-lg shadow-yellow-400/20' : 'border-gray-600 hover:border-blue-500'
                      }`}>
                      {/* Header */}
                      <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-3">
                        <div className="flex justify-between items-center">
                          <h3 className="text-lg font-semibold">
                            {session.application || 'Prediction Market'}
                            {isActiveMarket && (
                              <span className="ml-2 text-xs bg-yellow-400 text-gray-900 px-2 py-1 rounded font-bold">
                                ACTIVE TEST
                              </span>
                            )}
                          </h3>
                          <span className={`px-2 py-1 rounded text-xs font-bold ${session.status === 'open' ? 'bg-green-500' :
                            session.status === 'closed' ? 'bg-red-500' : 'bg-yellow-500'
                            }`}>
                            {session.status?.toUpperCase()}
                          </span>
                        </div>
                        <p className="text-xs text-gray-200 mt-1 font-mono">
                          ID: {(session.appSessionId || session.app_session_id)?.slice(0, 20)}...
                        </p>
                      </div>

                      {/* Market Stats */}
                      <div className="p-4 space-y-3">
                        {/* Protocol and Version */}
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-xs text-gray-400">Protocol</p>
                            <p className="text-sm font-mono">{session.protocol}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-400">Version</p>
                            <p className="text-sm">{session.version}</p>
                          </div>
                        </div>

                        {/* Challenge and Nonce */}
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-xs text-gray-400">Challenge Period</p>
                            <p className="text-sm">{session.challenge ? `${session.challenge}s` : 'N/A'}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-400">Nonce</p>
                            <p className="text-sm font-mono">{session.nonce}</p>
                          </div>
                        </div>

                        {/* Quorum */}
                        <div>
                          <p className="text-xs text-gray-400">Consensus Quorum</p>
                          <div className="flex items-center space-x-2">
                            <div className="flex-1 bg-gray-600 rounded-full h-2">
                              <div
                                className="bg-blue-500 h-2 rounded-full"
                                style={{ width: `${session.quorum || 0}%` }}
                              />
                            </div>
                            <span className="text-sm">{session.quorum || 0}%</span>
                          </div>
                        </div>

                        {/* Participants and Weights */}
                        <div>
                          <p className="text-xs text-gray-400 mb-2">Participants & Weights</p>
                          <div className="space-y-1">
                            {session.participants?.map((participant: string, pIdx: number) => {
                              const isYesPool = participant === '0x0000000000000000000000000000000000000001';
                              const isNoPool = participant === '0x0000000000000000000000000000000000000002';
                              const label = isYesPool ? 'YES Pool' : isNoPool ? 'NO Pool' : 'User';
                              const color = isYesPool ? 'text-green-400' : isNoPool ? 'text-red-400' : 'text-blue-400';

                              return (
                                <div key={pIdx} className="flex justify-between items-center text-xs bg-gray-800 p-2 rounded">
                                  <span className={`${color} font-semibold`}>{label}</span>
                                  <span className="font-mono text-gray-300">
                                    {isYesPool || isNoPool ? formatAddress(participant) : formatAddress(participant)}
                                  </span>
                                  <span className="text-yellow-400">Weight: {session.weights?.[pIdx] || 0}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Betting Pools */}
                        {(yesPool || noPool) && (
                          <div>
                            <p className="text-xs text-gray-400 mb-2">Betting Pools</p>
                            <div className="grid grid-cols-2 gap-2">
                              <div className="bg-green-900/30 p-2 rounded border border-green-600">
                                <p className="text-xs text-green-400 font-semibold">YES</p>
                                <p className="text-lg font-bold">{yesPool?.amount || '0'}</p>
                                <p className="text-xs text-gray-400">{yesPool?.asset || 'ytest.usd'}</p>
                              </div>
                              <div className="bg-red-900/30 p-2 rounded border border-red-600">
                                <p className="text-xs text-red-400 font-semibold">NO</p>
                                <p className="text-lg font-bold">{noPool?.amount || '0'}</p>
                                <p className="text-xs text-gray-400">{noPool?.asset || 'ytest.usd'}</p>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Timestamps */}
                        <div className="pt-2 border-t border-gray-600">
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div>
                              <p className="text-gray-400">Created</p>
                              <p>{session.createdAt ? new Date(session.createdAt).toLocaleString() : 'N/A'}</p>
                            </div>
                            <div>
                              <p className="text-gray-400">Updated</p>
                              <p>{session.updatedAt ? new Date(session.updatedAt).toLocaleString() : 'N/A'}</p>
                            </div>
                          </div>
                        </div>

                        {/* All Allocations */}
                        {session.allocations && session.allocations.length > 0 && (
                          <div className="pt-2 border-t border-gray-600">
                            <p className="text-xs text-gray-400 mb-2">All Allocations</p>
                            {session.allocations.map((alloc: any, allocIdx: number) => (
                              <div key={allocIdx} className="text-xs bg-gray-800 p-2 rounded mb-1 flex justify-between">
                                <span className="font-mono">{formatAddress(alloc.participant)}</span>
                                <span className="text-yellow-400">{alloc.amount} {alloc.asset}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Market Operations Component - Only for open sessions */}
                        <InlineMarketOperations 
                          sessionId={sessionId}
                          session={session}
                          yellowClient={yellowClientRef.current}
                          userAddress={address as Address}
                          onUpdate={fetchAppSessions}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}