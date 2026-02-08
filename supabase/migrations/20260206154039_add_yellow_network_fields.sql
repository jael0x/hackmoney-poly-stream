/*
  # Add Yellow Network Integration Fields

  This migration adds fields necessary for Yellow Network app session integration:
  - app_session_id: Yellow Network app session identifier
  - pool_yes_address: Address of YES betting pool
  - pool_no_address: Address of NO betting pool
  - oracle_address: Address of the oracle that resolves the market
  - yes_amount: Total amount staked on YES (in smallest unit)
  - no_amount: Total amount staked on NO (in smallest unit)
  - twitch_metric: Metric to track (e.g., 'followers_count', 'viewer_count')
  - target_value: Target value for the metric to determine winner
  - winner: Result of the market resolution ('yes' or 'no')
*/

-- Add Yellow Network fields to markets table
ALTER TABLE markets
ADD COLUMN IF NOT EXISTS app_session_id text,
ADD COLUMN IF NOT EXISTS pool_yes_address text,
ADD COLUMN IF NOT EXISTS pool_no_address text,
ADD COLUMN IF NOT EXISTS oracle_address text,
ADD COLUMN IF NOT EXISTS yes_amount text DEFAULT '0',
ADD COLUMN IF NOT EXISTS no_amount text DEFAULT '0',
ADD COLUMN IF NOT EXISTS twitch_metric text DEFAULT 'viewer_count',
ADD COLUMN IF NOT EXISTS target_value integer DEFAULT 10000,
ADD COLUMN IF NOT EXISTS winner text CHECK (winner IN ('yes', 'no'));

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_markets_app_session_id ON markets(app_session_id);
CREATE INDEX IF NOT EXISTS idx_markets_winner ON markets(winner);
CREATE INDEX IF NOT EXISTS idx_markets_twitch_metric ON markets(twitch_metric);

-- Add comments for documentation
COMMENT ON COLUMN markets.app_session_id IS 'Yellow Network app session ID for this prediction market';
COMMENT ON COLUMN markets.pool_yes_address IS 'Address of the YES betting pool participant';
COMMENT ON COLUMN markets.pool_no_address IS 'Address of the NO betting pool participant';
COMMENT ON COLUMN markets.oracle_address IS 'Address of the oracle that resolves the market';
COMMENT ON COLUMN markets.yes_amount IS 'Total amount staked on YES outcome (in smallest unit, e.g., 6 decimals for USDC)';
COMMENT ON COLUMN markets.no_amount IS 'Total amount staked on NO outcome (in smallest unit)';
COMMENT ON COLUMN markets.twitch_metric IS 'Twitch API metric to track (e.g., followers_count, viewer_count)';
COMMENT ON COLUMN markets.target_value IS 'Target value for the metric. If actual >= target, YES wins; otherwise NO wins';
COMMENT ON COLUMN markets.winner IS 'Winner of the market after resolution (yes or no)';
