/**
 * Type definitions for the Nitrolite Prediction Market
 * These types define the structure of data used throughout the application
 */

import type { Address } from 'viem';

/**
 * Represents a user's wallet connection status
 */
export interface WalletState {
  isConnected: boolean;
  address?: Address;
  balance?: bigint;
  tokenBalance?: bigint;
}

/**
 * Yellow Network channel states
 */
export interface ChannelState {
  channelId?: string;
  isOpen: boolean;
  balance: bigint;
  lockedBalance: bigint;
  serverSignature?: string;
}

/**
 * WebSocket connection status
 */
export interface WebSocketState {
  isConnected: boolean;
  connectionError?: string;
  lastMessage?: any;
}

/**
 * Authentication state for Yellow Network
 */
export interface AuthState {
  sessionKey?: Address;
  sessionExpiry?: bigint;
  isAuthenticated: boolean;
}

/**
 * Prediction market structure
 */
export interface PredictionMarket {
  id: string;
  question: string;
  description?: string;
  outcomes: MarketOutcome[];
  totalVolume: bigint;
  participantCount: number;
  createdAt: Date;
  resolveAt?: Date;
  isResolved: boolean;
  winningOutcome?: number;
}

/**
 * Market outcome (YES/NO for binary markets)
 */
export interface MarketOutcome {
  id: number;
  label: string; // "YES" or "NO"
  totalStake: bigint;
  probability: number; // 0-100
  color: string; // For UI display
}

/**
 * User's position in a market
 */
export interface UserPosition {
  marketId: string;
  outcomeId: number;
  amount: bigint;
  potentialPayout: bigint;
  timestamp: Date;
}

/**
 * Transaction status for UI feedback
 */
export interface TransactionState {
  isLoading: boolean;
  hash?: string;
  error?: string;
  message?: string;
}