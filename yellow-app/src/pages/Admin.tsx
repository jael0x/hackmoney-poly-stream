/**
 * Admin Page Component
 * Administrative interface for market creation and resolution
 */

import React, { useState, useEffect } from 'react';
import { useStore } from '../store';
import { getMarketManager } from '../services/market';
import { useAccount } from 'wagmi';

/**
 * Admin page component
 * Allows creating and resolving prediction markets
 */
export const Admin: React.FC = () => {
  const { isConnected } = useAccount();
  const { setTransaction } = useStore();
  const [markets, setMarkets] = useState<any[]>([]);
  const [newMarket, setNewMarket] = useState({
    question: '',
    description: '',
    resolutionDate: '',
  });
  const [isCreating, setIsCreating] = useState(false);

  /**
   * Load all markets
   */
  useEffect(() => {
    loadMarkets();
  }, []);

  /**
   * Load markets from manager
   */
  const loadMarkets = () => {
    const marketManager = getMarketManager();
    const allMarkets = marketManager.getAllMarkets();
    setMarkets(allMarkets);
  };

  /**
   * Handle market creation
   */
  const handleCreateMarket = async () => {
    if (!newMarket.question) {
      setTransaction({ error: 'Please enter a question' });
      return;
    }

    setIsCreating(true);
    setTransaction({ isLoading: true, message: 'Creating market...' });

    try {
      const marketManager = getMarketManager();

      marketManager.createMarket({
        question: newMarket.question,
        description: newMarket.description || undefined,
        resolutionDate: newMarket.resolutionDate
          ? new Date(newMarket.resolutionDate)
          : undefined,
      });

      setTransaction({
        isLoading: false,
        message: `Market created successfully!`,
      });

      // Reset form
      setNewMarket({
        question: '',
        description: '',
        resolutionDate: '',
      });

      // Reload markets
      loadMarkets();
    } catch (error: any) {
      console.error('[Admin] Error creating market:', error);
      setTransaction({
        isLoading: false,
        error: error.message || 'Failed to create market',
      });
    } finally {
      setIsCreating(false);
    }
  };

  /**
   * Handle market resolution
   */
  const handleResolveMarket = async (marketId: string, winningOutcome: number) => {
    setTransaction({ isLoading: true, message: 'Resolving market...' });

    try {
      const marketManager = getMarketManager();

      marketManager.resolveMarket({
        marketId,
        winningOutcomeId: winningOutcome,
      });

      setTransaction({
        isLoading: false,
        message: `Market resolved: ${winningOutcome === 0 ? 'YES' : 'NO'} wins!`,
      });

      // Reload markets
      loadMarkets();
    } catch (error: any) {
      console.error('[Admin] Error resolving market:', error);
      setTransaction({
        isLoading: false,
        error: error.message || 'Failed to resolve market',
      });
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">Admin Panel</h1>

        {/* Warning */}
        {!isConnected && (
          <div className="bg-yellow-900/20 border border-yellow-600/30 rounded-lg p-4 mb-6">
            <p className="text-yellow-400">
              ⚠️ Please connect your wallet to access admin features
            </p>
          </div>
        )}

        {/* Create New Market */}
        <div className="bg-gray-900 rounded-lg p-6 mb-8">
          <h2 className="text-2xl font-semibold mb-4">Create New Market</h2>

          <div className="space-y-4">
            {/* Question Input */}
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Question *
              </label>
              <input
                type="text"
                value={newMarket.question}
                onChange={(e) => setNewMarket({ ...newMarket, question: e.target.value })}
                placeholder="Will ETH reach $10,000 by end of 2026?"
                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Description Input */}
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Description (Optional)
              </label>
              <textarea
                value={newMarket.description}
                onChange={(e) => setNewMarket({ ...newMarket, description: e.target.value })}
                placeholder="Detailed description of resolution criteria..."
                rows={3}
                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Resolution Date Input */}
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Resolution Date (Optional)
              </label>
              <input
                type="datetime-local"
                value={newMarket.resolutionDate}
                onChange={(e) => setNewMarket({ ...newMarket, resolutionDate: e.target.value })}
                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Create Button */}
            <button
              onClick={handleCreateMarket}
              disabled={!isConnected || !newMarket.question || isCreating}
              className="w-full py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white font-semibold rounded-lg transition-colors"
            >
              {isCreating ? 'Creating...' : 'Create Market'}
            </button>
          </div>
        </div>

        {/* Existing Markets */}
        <div className="bg-gray-900 rounded-lg p-6">
          <h2 className="text-2xl font-semibold mb-4">Existing Markets</h2>

          {markets.length === 0 ? (
            <p className="text-gray-400">No markets created yet</p>
          ) : (
            <div className="space-y-4">
              {markets.map((market) => (
                <div key={market.id} className="bg-gray-800 rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold mb-2">{market.question}</h3>
                      {market.description && (
                        <p className="text-sm text-gray-400 mb-2">{market.description}</p>
                      )}

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                        <div>
                          <span className="text-gray-400">ID: </span>
                          <span className="font-mono">{market.id}</span>
                        </div>
                        <div>
                          <span className="text-gray-400">Volume: </span>
                          <span>{(Number(market.totalVolume) / 10 ** 6).toFixed(2)} USDC</span>
                        </div>
                        <div>
                          <span className="text-gray-400">Participants: </span>
                          <span>{market.participantCount}</span>
                        </div>
                        <div>
                          <span className="text-gray-400">Status: </span>
                          <span className={market.isResolved ? 'text-gray-400' : 'text-green-400'}>
                            {market.isResolved ? 'Resolved' : 'Active'}
                          </span>
                        </div>
                      </div>

                      {/* Outcome Probabilities */}
                      <div className="flex space-x-4 mt-3">
                        <div className="flex items-center space-x-2">
                          <span className="text-green-400 font-semibold">YES:</span>
                          <span>{market.outcomes[0].probability}%</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="text-red-400 font-semibold">NO:</span>
                          <span>{market.outcomes[1].probability}%</span>
                        </div>
                      </div>
                    </div>

                    {/* Resolution Buttons */}
                    {!market.isResolved && (
                      <div className="flex flex-col space-y-2 ml-4">
                        <button
                          onClick={() => handleResolveMarket(market.id, 0)}
                          disabled={!isConnected}
                          className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white text-sm rounded transition-colors"
                        >
                          Resolve YES
                        </button>
                        <button
                          onClick={() => handleResolveMarket(market.id, 1)}
                          disabled={!isConnected}
                          className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white text-sm rounded transition-colors"
                        >
                          Resolve NO
                        </button>
                      </div>
                    )}

                    {/* Resolved Badge */}
                    {market.isResolved && (
                      <div className="ml-4">
                        <div className={`px-3 py-1 rounded text-sm font-semibold ${
                          market.winningOutcome === 0
                            ? 'bg-green-600 text-white'
                            : 'bg-red-600 text-white'
                        }`}>
                          {market.winningOutcome === 0 ? 'YES Won' : 'NO Won'}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Channel Management Info */}
        <div className="mt-8 bg-gray-900 rounded-lg p-6">
          <h2 className="text-2xl font-semibold mb-4">Channel Management</h2>
          <p className="text-gray-400 mb-4">
            Channel operations like deposits and withdrawals should be managed through the Yellow Network interface.
          </p>
          <div className="bg-gray-800 rounded p-4">
            <h3 className="font-semibold mb-2">Test Workflow:</h3>
            <ol className="space-y-1 text-sm text-gray-300">
              <li>1. Connect wallet on Home page</li>
              <li>2. Authenticate with Yellow Network</li>
              <li>3. Create payment channel</li>
              <li>4. Deposit test USDC into channel</li>
              <li>5. Create markets in Admin panel</li>
              <li>6. Place predictions in Market page</li>
              <li>7. Resolve markets when ready</li>
              <li>8. Withdraw funds from channel</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
};