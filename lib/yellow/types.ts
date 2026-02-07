/**
 * Yellow Network Type Definitions
 *
 * TypeScript types for Yellow Network integration including
 * app sessions, allocations, and prediction market structures.
 */

import type { RPCResponse } from '@erc7824/nitrolite';

// ============================================================================
// App Session Types
// ============================================================================

export interface AppDefinition {
  protocol: 'NitroRPC/0.4';
  participants: [string, string, string]; // [poolYes, poolNo, oracle]
  weights: [number, number, number]; // [0, 0, 100] - oracle controls
  quorum: number; // 100
  challenge: number; // Challenge period in seconds
  nonce: number; // Unique identifier
}

export interface Allocation {
  participant: string; // Address
  asset: string; // Asset identifier (e.g., 'ytest.usd')
  amount: string; // Amount as string (to handle large numbers)
}

export interface AppSessionRequest {
  definition: AppDefinition;
  allocations: Allocation[];
}

export interface AppSessionResponse {
  app_session_id: string;
  status: 'open' | 'closed';
}

// ============================================================================
// Market Types
// ============================================================================

export enum MarketType {
  REACH_FOLLOWER_COUNT = 'reach_follower_count',
  REACH_VIEWER_COUNT = 'reach_viewer_count',
  PEAK_VIEWERS = 'peak_viewers',
  STREAM_HOURS = 'stream_hours',
  CHANGE_CATEGORY = 'change_category',
  PLAY_SPECIFIC_GAME = 'play_specific_game',
}

export enum MarketStatus {
  ACTIVE = 'active',
  CLOSED = 'closed',
  RESOLVED = 'resolved',
  CANCELLED = 'cancelled',
}

export interface PredictionMarket {
  id: string;
  app_session_id: string;
  streamer_id: string;
  question: string;
  description: string;
  market_type: MarketType;
  target_value: number;
  twitch_metric: string; // e.g., 'followers_count', 'viewer_count'

  // Pool addresses
  pool_yes_address: string;
  pool_no_address: string;
  oracle_address: string;

  // Market state
  yes_amount: string;
  no_amount: string;
  total_volume: string;
  yes_price: number; // Calculated from amounts
  no_price: number; // Calculated from amounts

  // Timing
  created_at: string;
  end_date: string;
  resolved_at?: string;

  // Resolution
  status: MarketStatus;
  winner?: 'yes' | 'no';
}

// ============================================================================
// Bet Types
// ============================================================================

export interface Bet {
  id: string;
  user_id: string;
  market_id: string;
  side: 'yes' | 'no';
  amount: string;
  price_at_bet: number; // Price when bet was placed
  yellow_tx_id?: string;
  created_at: string;
}

export interface UserPosition {
  market: PredictionMarket;
  bet: Bet;
  potential_payout: string;
  current_value: string;
}

// ============================================================================
// Balance Types
// ============================================================================

export interface Balance {
  asset: string;
  amount: string;
}

export interface UnifiedBalance {
  balances: Balance[];
  updated_at: string;
}

// ============================================================================
// Session Key Types
// ============================================================================

export interface SessionKeyConfig {
  address: string; // Main wallet address
  session_key: string; // Session key address
  application: string;
  allowances: Array<{
    asset: string;
    amount: string;
  }>;
  scope: string;
  expires_at: number; // Unix timestamp in seconds
}

export interface ActiveSessionKey {
  id: number;
  session_key: string;
  application: string;
  allowances: Array<{
    asset: string;
    allowance: string;
    used: string;
  }>;
  scope: string;
  expires_at: string; // ISO 8601
  created_at: string; // ISO 8601
}

// ============================================================================
// Yellow Client Types
// ============================================================================

export interface YellowClientConfig {
  wsUrl?: string;
  autoReconnect?: boolean;
  reconnectAttempts?: number;
  reconnectInterval?: number;
}

export enum ConnectionStatus {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  AUTHENTICATED = 'authenticated',
  ERROR = 'error',
}

export interface YellowClientState {
  status: ConnectionStatus;
  address?: string;
  sessionKey?: string;
  unifiedBalance?: UnifiedBalance;
  walletBalances?: any[];
  error?: string;
}

// ============================================================================
// Oracle Types
// ============================================================================

export interface OracleResolutionData {
  market_id: string;
  twitch_metric: string;
  target_value: number;
  actual_value: number;
  winner: 'yes' | 'no';
  resolved_at: string;
}

// ============================================================================
// Transaction Types
// ============================================================================

export interface DepositRequest {
  asset: string;
  amount: string;
  chain_id?: number;
}

export interface WithdrawRequest {
  asset: string;
  amount: string;
  chain_id?: number;
  destination: string;
}

export interface BetRequest {
  market_id: string;
  side: 'yes' | 'no';
  amount: string;
}

// ============================================================================
// Utility Types
// ============================================================================

export type Listener<T = RPCResponse> = (message: T) => void | Promise<void>;

export interface RequestOptions {
  timeout?: number;
}
