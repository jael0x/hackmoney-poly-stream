/**
 * Market Page Component
 * Displays prediction market and betting interface
 */

import React, { useEffect, useState } from 'react';
import { useStore } from '../store';
import { getMarketManager } from '../services/market';
import { useAccount } from 'wagmi';

/**
 * Market page component
 * Shows current market, odds, and allows placing bets
 */
export const Market: React.FC = () => {
  const { address } = useAccount();
  const { channel, setTransaction, selectedOutcome, setSelectedOutcome, betAmount, setBetAmount } = useStore();
  const [market, setMarket] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [isPlacingBet, setIsPlacingBet] = useState(false);

  /**
   * Load market data
   */
  useEffect(() => {
    const marketManager = getMarketManager();
    const activeMarkets = marketManager.getActiveMarkets();

    if (activeMarkets.length > 0) {
      const currentMarket = activeMarkets[0];
      setMarket(currentMarket);

      // Get market stats
      const marketStats = marketManager.getMarketStats(currentMarket.id);
      setStats(marketStats);
    }

    // Refresh market data every 5 seconds
    const interval = setInterval(() => {
      const activeMarkets = marketManager.getActiveMarkets();
      if (activeMarkets.length > 0) {
        const currentMarket = activeMarkets[0];
        setMarket(currentMarket);
        const marketStats = marketManager.getMarketStats(currentMarket.id);
        setStats(marketStats);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  /**
   * Handle bet placement
   */
  const handlePlaceBet = async () => {
    if (!market || selectedOutcome === null || !betAmount || !address) {
      return;
    }

    const amount = parseFloat(betAmount);
    if (isNaN(amount) || amount <= 0) {
      setTransaction({ error: 'Please enter a valid amount' });
      return;
    }

    setIsPlacingBet(true);
    setTransaction({ isLoading: true, message: 'Placing bet...' });

    try {
      const marketManager = getMarketManager();

      // Convert amount to bigint (assuming 6 decimals for USDC)
      const amountBigInt = BigInt(Math.floor(amount * 10 ** 6));

      // Check if user has enough balance in channel
      if (channel.balance < amountBigInt) {
        throw new Error('Insufficient channel balance. Please deposit more funds.');
      }

      // Place the bet
      marketManager.placeBet({
        marketId: market.id,
        outcomeId: selectedOutcome,
        amount: amountBigInt,
        userAddress: address,
      });

      setTransaction({
        isLoading: false,
        message: `Successfully placed ${amount} USDC on ${selectedOutcome === 0 ? 'YES' : 'NO'}!`,
      });

      // Reset form
      setBetAmount('');
      setSelectedOutcome(null);

      // Refresh market data
      const updatedMarket = marketManager.getMarket(market.id);
      setMarket(updatedMarket);
      const marketStats = marketManager.getMarketStats(market.id);
      setStats(marketStats);

    } catch (error: any) {
      console.error('[Market] Error placing bet:', error);
      setTransaction({
        isLoading: false,
        error: error.message || 'Failed to place bet',
      });
    } finally {
      setIsPlacingBet(false);
    }
  };

  if (!market) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-semibold mb-4">No Active Markets</h2>
          <p className="text-gray-400">Please check back later or create a market in the admin panel.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="container mx-auto px-4 py-8">
        {/* Market Header */}
        <div className="bg-gray-900 rounded-lg p-6 mb-6">
          <h1 className="text-3xl font-bold mb-4">{market.question}</h1>
          {market.description && (
            <p className="text-gray-300 mb-4">{market.description}</p>
          )}

          {/* Market Stats */}
          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
              <div className="bg-gray-800 rounded p-3">
                <p className="text-sm text-gray-400">Total Volume</p>
                <p className="text-xl font-semibold">{stats.totalVolume}</p>
              </div>
              <div className="bg-gray-800 rounded p-3">
                <p className="text-sm text-gray-400">Participants</p>
                <p className="text-xl font-semibold">{stats.participantCount}</p>
              </div>
              <div className="bg-gray-800 rounded p-3">
                <p className="text-sm text-gray-400">Time Until Resolution</p>
                <p className="text-xl font-semibold">{stats.timeUntilResolution || 'N/A'}</p>
              </div>
              <div className="bg-gray-800 rounded p-3">
                <p className="text-sm text-gray-400">Status</p>
                <p className="text-xl font-semibold text-green-400">
                  {market.isResolved ? 'Resolved' : 'Active'}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Outcomes Grid */}
        <div className="grid md:grid-cols-2 gap-6 mb-6">
          {/* YES Outcome */}
          <div
            className={`bg-gray-900 rounded-lg p-6 border-2 cursor-pointer transition-all ${
              selectedOutcome === 0
                ? 'border-green-500 shadow-lg shadow-green-500/20'
                : 'border-gray-800 hover:border-gray-700'
            }`}
            onClick={() => setSelectedOutcome(selectedOutcome === 0 ? null : 0)}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-2xl font-bold text-green-400">YES</h3>
              <span className="text-3xl font-bold">{market.outcomes[0].probability}%</span>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Total Stake</span>
                <span>{(Number(market.outcomes[0].totalStake) / 10 ** 6).toFixed(2)} USDC</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Implied Odds</span>
                <span>{(100 / market.outcomes[0].probability).toFixed(2)}x</span>
              </div>
            </div>

            {/* Probability Bar */}
            <div className="mt-4 h-2 bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 transition-all duration-500"
                style={{ width: `${market.outcomes[0].probability}%` }}
              />
            </div>
          </div>

          {/* NO Outcome */}
          <div
            className={`bg-gray-900 rounded-lg p-6 border-2 cursor-pointer transition-all ${
              selectedOutcome === 1
                ? 'border-red-500 shadow-lg shadow-red-500/20'
                : 'border-gray-800 hover:border-gray-700'
            }`}
            onClick={() => setSelectedOutcome(selectedOutcome === 1 ? null : 1)}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-2xl font-bold text-red-400">NO</h3>
              <span className="text-3xl font-bold">{market.outcomes[1].probability}%</span>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Total Stake</span>
                <span>{(Number(market.outcomes[1].totalStake) / 10 ** 6).toFixed(2)} USDC</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Implied Odds</span>
                <span>{(100 / market.outcomes[1].probability).toFixed(2)}x</span>
              </div>
            </div>

            {/* Probability Bar */}
            <div className="mt-4 h-2 bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-red-500 transition-all duration-500"
                style={{ width: `${market.outcomes[1].probability}%` }}
              />
            </div>
          </div>
        </div>

        {/* Betting Interface */}
        {!market.isResolved && (
          <div className="bg-gray-900 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Place Prediction</h2>

            <div className="space-y-4">
              {/* Selected Outcome */}
              {selectedOutcome !== null && (
                <div className="bg-gray-800 rounded p-3">
                  <p className="text-sm text-gray-400">Selected Outcome</p>
                  <p className={`text-lg font-semibold ${
                    selectedOutcome === 0 ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {selectedOutcome === 0 ? 'YES' : 'NO'} @ {market.outcomes[selectedOutcome].probability}%
                  </p>
                </div>
              )}

              {/* Amount Input */}
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Amount (USDC)
                </label>
                <input
                  type="number"
                  value={betAmount}
                  onChange={(e) => setBetAmount(e.target.value)}
                  placeholder="0.00"
                  min="0.01"
                  step="0.01"
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Potential Payout */}
              {betAmount && selectedOutcome !== null && (
                <div className="bg-gray-800 rounded p-3">
                  <p className="text-sm text-gray-400">Potential Payout</p>
                  <p className="text-lg font-semibold">
                    {(parseFloat(betAmount) * (100 / market.outcomes[selectedOutcome].probability)).toFixed(2)} USDC
                  </p>
                </div>
              )}

              {/* Channel Balance */}
              <div className="bg-gray-800 rounded p-3">
                <p className="text-sm text-gray-400">Channel Balance</p>
                <p className="text-lg font-semibold">
                  {(Number(channel.balance) / 10 ** 6).toFixed(2)} USDC
                </p>
              </div>

              {/* Place Bet Button */}
              <button
                onClick={handlePlaceBet}
                disabled={
                  !channel.isOpen ||
                  selectedOutcome === null ||
                  !betAmount ||
                  isPlacingBet ||
                  parseFloat(betAmount) <= 0
                }
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white font-semibold rounded-lg transition-colors"
              >
                {isPlacingBet ? 'Placing Bet...' : 'Place Prediction'}
              </button>

              {/* Warning for no channel */}
              {!channel.isOpen && (
                <p className="text-yellow-400 text-sm text-center">
                  ⚠️ Please connect to Yellow Network and deposit funds first
                </p>
              )}
            </div>
          </div>
        )}

        {/* Resolution Banner */}
        {market.isResolved && (
          <div className="bg-gray-900 rounded-lg p-6 border-2 border-green-500">
            <h2 className="text-xl font-semibold mb-2">Market Resolved</h2>
            <p className="text-lg">
              Winning Outcome:{' '}
              <span className={`font-bold ${
                market.winningOutcome === 0 ? 'text-green-400' : 'text-red-400'
              }`}>
                {market.winningOutcome === 0 ? 'YES' : 'NO'}
              </span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
};