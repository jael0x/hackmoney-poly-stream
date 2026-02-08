/**
 * Yellow Network Configuration
 *
 * Configuration for connecting to Yellow Network ClearNodes
 * and managing prediction markets via app sessions.
 */

export const YELLOW_CONFIG = {
  // WebSocket endpoints
  CLEARNODE_WS_URL: process.env.NEXT_PUBLIC_YELLOW_WS_URL || 'wss://clearnet-sandbox.yellow.com/ws',

  // Application name for session keys
  APPLICATION_NAME: 'HackMoney PolyStream',

  // Session key configuration
  SESSION_KEY_EXPIRY: 3600, // 1 hour in seconds
  SESSION_KEY_SCOPE: 'app.create',

  // Default allowances for session keys
  DEFAULT_ALLOWANCES: [
    { asset: 'ytest.usd', amount: '10000000' }, // 10M test USDC (6 decimals) - increased for larger deposits
  ],

  // App Session configuration for prediction markets
  APP_SESSION: {
    PROTOCOL: 'NitroRPC/0.4' as const,
    CHALLENGE_PERIOD: 3600, // 1 hour in seconds
    QUORUM: 100, // Oracle has full control
  },

  // Market configuration
  MARKET: {
    MIN_BET_AMOUNT: '1', // 1 USDC minimum bet
    MAX_BET_AMOUNT: '10000', // 10K USDC maximum bet
    DEFAULT_DURATION: 7 * 24 * 60 * 60, // 7 days in seconds
    // Pool addresses for YES and NO outcomes
    POOL_YES_ADDRESS: '0x0000000000000000000000000000000000000001' as const,
    POOL_NO_ADDRESS: '0x0000000000000000000000000000000000000002' as const,
  },

  // Oracle configuration
  ORACLE: {
    CHECK_INTERVAL: 60 * 1000, // Check every minute
    RESOLUTION_DELAY: 5 * 60 * 1000, // Wait 5 minutes before resolving
  },
} as const;

// Asset identifiers
export const ASSETS = {
  USDC: 'ytest.usd', // Sandbox test USDC
} as const;

// Supported networks (for future multi-chain support)
export const SUPPORTED_CHAINS = {
  SEPOLIA: 11155111,
  BASE_SEPOLIA: 84532,
} as const;
