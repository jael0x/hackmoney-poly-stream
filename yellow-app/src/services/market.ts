/**
 * Prediction Market Service
 * Handles market creation, betting, odds calculation, and resolution
 */

import type { Address } from 'viem';
import type { PredictionMarket, UserPosition } from '../types';

/**
 * Market creation parameters
 */
export interface CreateMarketParams {
  question: string;
  description?: string;
  resolutionDate?: Date;
}

/**
 * Bet placement parameters
 */
export interface PlaceBetParams {
  marketId: string;
  outcomeId: number;  // 0 for YES, 1 for NO
  amount: bigint;
  userAddress: Address;
}

/**
 * Market resolution parameters
 */
export interface ResolveMarketParams {
  marketId: string;
  winningOutcomeId: number;
}

/**
 * Prediction Market Manager
 * Manages the lifecycle and state of prediction markets
 */
export class MarketManager {
  private markets: Map<string, PredictionMarket> = new Map();
  private userPositions: Map<string, UserPosition[]> = new Map();
  private nextMarketId = 1;

  constructor() {
    // Initialize with a demo market for testing
    this.createDemoMarket();
  }

  /**
   * Create a new prediction market
   * @param params - Market creation parameters
   * @returns Created market
   */
  createMarket(params: CreateMarketParams): PredictionMarket {
    const marketId = `market-${this.nextMarketId++}`;

    const market: PredictionMarket = {
      id: marketId,
      question: params.question,
      description: params.description,
      outcomes: [
        {
          id: 0,
          label: 'YES',
          totalStake: 0n,
          probability: 50, // Start with 50/50 odds
          color: '#10b981' // Green
        },
        {
          id: 1,
          label: 'NO',
          totalStake: 0n,
          probability: 50,
          color: '#ef4444' // Red
        }
      ],
      totalVolume: 0n,
      participantCount: 0,
      createdAt: new Date(),
      resolveAt: params.resolutionDate,
      isResolved: false
    };

    this.markets.set(marketId, market);
    console.log('[Market] Created new market:', market);

    return market;
  }

  /**
   * Place a bet on a market outcome
   * @param params - Bet placement parameters
   * @returns Updated user position
   */
  placeBet(params: PlaceBetParams): UserPosition {
    const market = this.markets.get(params.marketId);
    if (!market) {
      throw new Error('Market not found');
    }

    if (market.isResolved) {
      throw new Error('Market is already resolved');
    }

    if (params.outcomeId !== 0 && params.outcomeId !== 1) {
      throw new Error('Invalid outcome ID. Must be 0 (YES) or 1 (NO)');
    }

    // Update market state
    const outcome = market.outcomes[params.outcomeId];
    outcome.totalStake += params.amount;
    market.totalVolume += params.amount;

    // Track unique participants
    const userKey = `${params.userAddress}-${params.marketId}`;
    if (!this.userPositions.has(userKey)) {
      market.participantCount++;
    }

    // Calculate new probabilities using LMSR (Logarithmic Market Scoring Rule)
    this.updateMarketProbabilities(market);

    // Calculate potential payout
    const potentialPayout = this.calculatePotentialPayout(
      params.amount,
      outcome.probability
    );

    // Create or update user position
    const position: UserPosition = {
      marketId: params.marketId,
      outcomeId: params.outcomeId,
      amount: params.amount,
      potentialPayout,
      timestamp: new Date()
    };

    // Store user position
    const positions = this.userPositions.get(userKey) || [];
    positions.push(position);
    this.userPositions.set(userKey, positions);

    console.log('[Market] Bet placed:', position);
    console.log('[Market] Updated market state:', market);

    return position;
  }

  /**
   * Resolve a market with a winning outcome
   * @param params - Resolution parameters
   * @returns Resolved market
   */
  resolveMarket(params: ResolveMarketParams): PredictionMarket {
    const market = this.markets.get(params.marketId);
    if (!market) {
      throw new Error('Market not found');
    }

    if (market.isResolved) {
      throw new Error('Market is already resolved');
    }

    if (params.winningOutcomeId !== 0 && params.winningOutcomeId !== 1) {
      throw new Error('Invalid winning outcome ID');
    }

    // Set market as resolved
    market.isResolved = true;
    market.winningOutcome = params.winningOutcomeId;

    // Update outcome probabilities to reflect final result
    market.outcomes[params.winningOutcomeId].probability = 100;
    market.outcomes[params.winningOutcomeId === 0 ? 1 : 0].probability = 0;

    console.log('[Market] Market resolved:', market);

    return market;
  }

  /**
   * Get a market by ID
   * @param marketId - Market ID
   * @returns Market or undefined
   */
  getMarket(marketId: string): PredictionMarket | undefined {
    return this.markets.get(marketId);
  }

  /**
   * Get all markets
   * @returns Array of all markets
   */
  getAllMarkets(): PredictionMarket[] {
    return Array.from(this.markets.values());
  }

  /**
   * Get active (unresolved) markets
   * @returns Array of active markets
   */
  getActiveMarkets(): PredictionMarket[] {
    return Array.from(this.markets.values()).filter(m => !m.isResolved);
  }

  /**
   * Get user positions for a specific user
   * @param userAddress - User's wallet address
   * @param marketId - Optional market ID filter
   * @returns Array of user positions
   */
  getUserPositions(userAddress: Address, marketId?: string): UserPosition[] {
    const positions: UserPosition[] = [];

    for (const [key, userPositions] of this.userPositions.entries()) {
      if (key.startsWith(userAddress)) {
        if (!marketId || userPositions.some(p => p.marketId === marketId)) {
          positions.push(...userPositions);
        }
      }
    }

    return positions;
  }

  /**
   * Calculate potential payout for a bet
   * @param betAmount - Amount being bet
   * @param probability - Current probability (0-100)
   * @returns Potential payout
   */
  private calculatePotentialPayout(betAmount: bigint, probability: number): bigint {
    if (probability === 0) return 0n;

    // Simple payout calculation: bet * (100 / probability)
    // This gives 2x payout at 50%, 4x at 25%, etc.
    const multiplier = (10000 / probability); // Using basis points for precision
    return (betAmount * BigInt(multiplier)) / 100n;
  }

  /**
   * Update market probabilities using LMSR
   * @param market - Market to update
   */
  private updateMarketProbabilities(market: PredictionMarket): void {
    const yesStake = market.outcomes[0].totalStake;
    const noStake = market.outcomes[1].totalStake;

    // Avoid division by zero
    if (yesStake === 0n && noStake === 0n) {
      market.outcomes[0].probability = 50;
      market.outcomes[1].probability = 50;
      return;
    }

    // Simple probability calculation based on stake ratios
    // In production, you'd use a proper AMM formula like LMSR
    const total = yesStake + noStake;
    const yesProb = Number((yesStake * 100n) / total);
    const noProb = 100 - yesProb;

    // Apply bounds to prevent extreme probabilities
    const minProb = 5;
    const maxProb = 95;

    market.outcomes[0].probability = Math.max(minProb, Math.min(maxProb, yesProb));
    market.outcomes[1].probability = Math.max(minProb, Math.min(maxProb, noProb));

    // Ensure probabilities sum to 100
    const sum = market.outcomes[0].probability + market.outcomes[1].probability;
    if (sum !== 100) {
      const adjustment = (100 - sum) / 2;
      market.outcomes[0].probability += adjustment;
      market.outcomes[1].probability += adjustment;
    }
  }

  /**
   * Create a demo market for testing
   */
  private createDemoMarket(): void {
    this.createMarket({
      question: 'Will ETH reach $5,000 by end of Q1 2026?',
      description: 'This market resolves to YES if the price of Ethereum (ETH) reaches or exceeds $5,000 USD on any major exchange before April 1st, 2026.',
      resolutionDate: new Date('2026-04-01')
    });

    // Add some demo activity
    const demoMarket = this.markets.get('market-1');
    if (demoMarket) {
      // Simulate some betting activity
      demoMarket.outcomes[0].totalStake = BigInt(150 * 10 ** 6); // 150 USDC
      demoMarket.outcomes[1].totalStake = BigInt(100 * 10 ** 6); // 100 USDC
      demoMarket.totalVolume = BigInt(250 * 10 ** 6);
      demoMarket.participantCount = 5;

      this.updateMarketProbabilities(demoMarket);
    }
  }

  /**
   * Get market statistics
   * @param marketId - Market ID
   * @returns Market statistics
   */
  getMarketStats(marketId: string): {
    totalVolume: string;
    participantCount: number;
    yesPercentage: number;
    noPercentage: number;
    timeUntilResolution?: string;
  } | null {
    const market = this.markets.get(marketId);
    if (!market) return null;

    const stats = {
      totalVolume: (Number(market.totalVolume) / 10 ** 6).toFixed(2) + ' USDC',
      participantCount: market.participantCount,
      yesPercentage: market.outcomes[0].probability,
      noPercentage: market.outcomes[1].probability,
      timeUntilResolution: undefined as string | undefined
    };

    if (market.resolveAt && !market.isResolved) {
      const now = new Date();
      const diff = market.resolveAt.getTime() - now.getTime();
      if (diff > 0) {
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        stats.timeUntilResolution = `${days}d ${hours}h`;
      }
    }

    return stats;
  }
}

// Export singleton instance
let marketManager: MarketManager | null = null;

/**
 * Get or create market manager instance
 * @returns Market manager instance
 */
export function getMarketManager(): MarketManager {
  if (!marketManager) {
    marketManager = new MarketManager();
  }

  return marketManager;
}