# Yellow Network Integration - Overview & Architecture

**Project:** HackMoney PolyStream - Twitch Prediction Markets
**Last Updated:** February 7, 2026
**Status:** Core Implementation Complete - Optimizations Pending

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Implementation Status](#implementation-status)
4. [Database Schema](#database-schema)
5. [Configuration](#configuration)
6. [Technical Decisions](#technical-decisions)
7. [Resources](#resources)

---

## Overview

### What is This?

A complete integration of **Yellow Network State Channels** into a Polymarket-style prediction market platform for Twitch streamers. Users can bet on whether streamers will reach specific metrics (viewer count, follower count) using off-chain, gasless transactions powered by Yellow Network.

### Why Yellow Network?

- **Instant Transactions**: Off-chain state channels eliminate gas costs and confirmation delays
- **Gasless Betting**: Users don't pay gas fees for each bet
- **Real-time Updates**: State channels enable immediate price updates
- **ERC-7824 Standard**: Built on emerging Ethereum state channel standard

### Key Features

- **Automatic Market Creation**: Scans live Twitch streams and generates markets
- **Manual Market Creation**: Users can create custom prediction markets
- **State Channel Betting**: All bets processed through Yellow Network App Sessions
- **Twitch Oracle**: Automated resolution based on Twitch API metrics
- **Winnings Distribution**: Automatic fund distribution to winners

---

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend (Next.js)                       │
├─────────────────────────────────────────────────────────────────┤
│  - Market Cards          - Bet Dialog       - Profile Dashboard │
│  - Create Market Form    - Yellow Provider  - Claim Winnings    │
└────────────┬────────────────────────────────────────────────────┘
             │
             ↓
┌─────────────────────────────────────────────────────────────────┐
│                        API Routes (Next.js)                      │
├─────────────────────────────────────────────────────────────────┤
│  - /api/markets/create      - Market creation with App Session  │
│  - /api/markets/auto-create - Batch market generation           │
│  - /api/markets/bet         - Process bets via Yellow Network   │
│  - /api/markets/claim       - Winnings distribution             │
│  - /api/oracle/run          - Oracle automation endpoint        │
└────────────┬────────────────────────────────────────────────────┘
             │
             ├─────────────────┬──────────────────┬────────────────┐
             ↓                 ↓                  ↓                ↓
┌──────────────────┐  ┌─────────────────┐  ┌──────────────┐  ┌────────────┐
│  Yellow Network  │  │  Supabase DB    │  │  Twitch API  │  │  Oracle    │
│  (App Sessions)  │  │  (PostgreSQL)   │  │  (Metrics)   │  │  (Cron)    │
├──────────────────┤  ├─────────────────┤  ├──────────────┤  ├────────────┤
│ - App Sessions   │  │ - markets       │  │ - viewers    │  │ - Close    │
│ - State Channels │  │ - streamers     │  │ - followers  │  │ - Resolve  │
│ - Allocations    │  │ - transactions  │  │ - streams    │  │ - Distribute│
└──────────────────┘  └─────────────────┘  └──────────────┘  └────────────┘
```

### Data Flow

#### 1. Market Creation Flow
```
User/Automation → API → Yellow Network → Create App Session
                   ↓                           ↓
              Supabase ← Store app_session_id ←
```

#### 2. Betting Flow
```
User → Connect Wallet → Authenticate Yellow → Deposit to Unified Balance
                                                        ↓
Market Page → Select Outcome → Enter Amount → Confirm Bet
                                                        ↓
API → Yellow Client → DEPOSIT Intent → Update App Session Allocations
                                                        ↓
            Supabase ← Update yes_amount/no_amount ←
                                                        ↓
                        Recalculate Prices → Refresh UI
```

#### 3. Resolution Flow
```
Cron Job → /api/oracle/run → Process Markets
                                    ↓
            ┌────────────────────────┴─────────────────────┐
            ↓                                              ↓
    Close Expired Markets                        Resolve Closed Markets
            ↓                                              ↓
    Update status='closed'                     Fetch Twitch Metrics
                                                           ↓
                                              Compare actual vs target
                                                           ↓
                                              Set winner='yes'|'no'
                                                           ↓
                                   Close App Session → Distribute Funds
```

---

## Implementation Status

### ✅ Completed Features

#### 1. Yellow Network Client (`lib/yellow/client.ts`)
- [x] Connection to ClearNet Sandbox
- [x] EIP-712 Authentication (simplified domain)
- [x] Session key management
- [x] Unified balance operations (deposit/withdraw)
- [x] App Session creation with 3 participants (YES pool, NO pool, Oracle)
- [x] Bet submission via DEPOSIT intent
- [x] App Session closure with final allocations
- [x] Dynamic odds calculation based on AMM formula
- [x] Get App Definition (read current allocations)
- [x] List App Sessions by participant

#### 2. Twitch Oracle (`lib/yellow/oracle.ts`)
- [x] Fetch Twitch metrics (viewer_count, followers_count)
- [x] Close expired markets (end_date <= now)
- [x] Resolve markets based on target comparison
- [x] Distribute winnings to winning pool
- [x] Batch processing for multiple markets
- [x] Error handling and retry logic

#### 3. API Endpoints
- [x] **POST /api/markets/create** - Manual market creation with App Session
- [x] **POST /api/markets/auto-create** - Automated market generation from live streams
- [x] **POST /api/markets/bet** - Place bets via Yellow Network
- [x] **POST /api/markets/claim** - Claim winnings (calculation ready, withdrawal pending)
- [x] **GET/POST /api/oracle/run** - Oracle automation endpoint with bearer token auth

#### 4. UI Components
- [x] **MarketCard** - Display market info with Yellow Network badges
- [x] **BetButton** - Integrated betting dialog with wallet connect
- [x] **CreateMarketForm** - Manual market creation with Twitch metrics
- [x] **ProfileContent** - Yellow Network balance dashboard
- [x] **ClaimWinningsButton** - Winnings claim interface
- [x] **YellowProvider** - Global Yellow Network state management

#### 5. Database Schema
- [x] Migration created: `20260206154039_add_yellow_network_fields.sql`
- [x] Added 9 new columns to `markets` table
- [x] Created indexes for performance
- [x] Added column documentation comments

### ⚠️ Partially Implemented

#### 6. Wallet Integration
- [x] Basic Yellow Network authentication
- [ ] **Real WalletConnect integration** (currently uses env private key)
- [ ] User wallet signature requests
- [ ] Multi-wallet support

#### 7. Transaction Tracking
- [x] Track total pool amounts (yes_amount, no_amount)
- [ ] **Individual bet tracking** (needs `bets` table)
- [ ] User bet history
- [ ] Transaction receipts

#### 8. Winnings Distribution
- [x] Calculate user winnings
- [x] Close App Sessions
- [ ] **Actual withdrawal to user wallets** (currently demo mode)
- [ ] Claimed status tracking

### 🔴 Not Implemented

#### 9. Advanced Features
- [ ] Advanced AMM pricing (CPMM)
- [ ] WebSocket live price updates
- [ ] User analytics dashboard
- [ ] Social sharing
- [ ] Leaderboards
- [ ] Push notifications

#### 10. Security & Performance
- [ ] Rate limiting on APIs
- [ ] Signature validation
- [ ] Front-running protection
- [ ] Caching layer for App Definitions
- [ ] Error monitoring (Sentry)

---

## Database Schema

### Migration: `20260206154039_add_yellow_network_fields.sql`

#### New Columns Added to `markets` Table

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `app_session_id` | text | null | Yellow Network App Session ID |
| `pool_yes_address` | text | null | Address of YES betting pool participant |
| `pool_no_address` | text | null | Address of NO betting pool participant |
| `oracle_address` | text | null | Address of oracle that resolves the market |
| `yes_amount` | text | '0' | Total staked on YES (string for BigInt) |
| `no_amount` | text | '0' | Total staked on NO (string for BigInt) |
| `twitch_metric` | text | 'viewer_count' | Metric to track (viewer_count, followers_count) |
| `target_value` | integer | 10000 | Target value for metric comparison |
| `winner` | text | null | Result after resolution ('yes' or 'no') |

#### Indexes Created

```sql
CREATE INDEX idx_markets_app_session_id ON markets(app_session_id);
CREATE INDEX idx_markets_winner ON markets(winner);
CREATE INDEX idx_markets_twitch_metric ON markets(twitch_metric);
```

#### Running the Migration

**Option 1: Supabase CLI (Recommended)**

```bash
# Install CLI
npm install -g supabase

# Link project
supabase link --project-ref hemrblmhvgzilttbodpp

# Apply migration
supabase db push

# Verify
supabase migration list
```

**Option 2: Manual Execution**

1. Go to Supabase Dashboard → SQL Editor
2. Copy contents of `supabase/migrations/20260206154039_add_yellow_network_fields.sql`
3. Click "Run"
4. Verify with:
   ```sql
   SELECT column_name, data_type, column_default
   FROM information_schema.columns
   WHERE table_name = 'markets'
   ORDER BY ordinal_position;
   ```

#### TypeScript Types Update

After migration, update `types/database.ts`:

```typescript
markets: {
  Row: {
    // ... existing fields
    app_session_id: string | null;
    pool_yes_address: string | null;
    pool_no_address: string | null;
    oracle_address: string | null;
    yes_amount: string;
    no_amount: string;
    twitch_metric: string;
    target_value: number;
    winner: 'yes' | 'no' | null;
  };
  Insert: {
    // ... same fields with optional types
  };
  Update: {
    // ... same fields with optional types
  };
}
```

### Proposed: `bets` Table (Pending Implementation)

```sql
CREATE TABLE bets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  market_id uuid REFERENCES markets(id) ON DELETE CASCADE,
  user_address text NOT NULL,
  position text CHECK (position IN ('yes', 'no')),
  amount text NOT NULL,  -- BigInt as string
  price_at_time numeric,
  created_at timestamp DEFAULT now(),
  claimed boolean DEFAULT false,
  claim_amount text  -- Amount claimed (if winner)
);

CREATE INDEX idx_bets_market_id ON bets(market_id);
CREATE INDEX idx_bets_user_address ON bets(user_address);
CREATE INDEX idx_bets_claimed ON bets(claimed);
```

**Purpose:**
- Track individual user bets
- Calculate per-user winnings
- Prevent double-claiming
- Display user bet history

---

## Configuration

### Environment Variables

**Required:**

```bash
# Twitch API
NEXT_PUBLIC_TWITCH_CLIENT_ID=your_client_id
TWITCH_CLIENT_SECRET=your_client_secret

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Yellow Network - Oracle
YELLOW_ORACLE_PRIVATE_KEY=0x...  # Oracle wallet private key
ORACLE_API_SECRET=your-secret-token  # For /api/oracle/run auth
```

**Optional (Development):**

```bash
# For testing without wallet connect
YELLOW_USER_PRIVATE_KEY=0x...  # Test user wallet

# Pool addresses (generated automatically if not set)
POOL_YES_ADDRESS=0x...
POOL_NO_ADDRESS=0x...
```

**Production Notes:**
- NEVER commit private keys to git
- Use environment variable management (Vercel, AWS Secrets Manager, etc.)
- Rotate secrets regularly
- Oracle wallet needs to be funded for gas (if on-chain settlement used)

### Yellow Network Configuration

**Network:** Sepolia Testnet + Yellow Sandbox
**ClearNet URL:** `wss://clearnet-sandbox.yellow.com/ws`
**Test Token:** ytest.usd (0xDB9F293e3898c9E5536A3be1b0C56c89d2b32DEb)
**Decimals:** 6

**Getting Test Tokens:**

1. Get Sepolia ETH from faucet
2. Request from Yellow Network faucet:
   ```bash
   curl -XPOST https://clearnet-sandbox.yellow.com/faucet/requestTokens \
     -H "Content-Type: application/json" \
     -d '{"userAddress":"YOUR_WALLET_ADDRESS"}'
   ```

**Supported Assets:**

Query via WebSocket:
```javascript
ws.send(JSON.stringify({
  req: [1, 'get_assets', {}, Date.now()],
  sig: []
}));
```

Common assets:
- `ytest.usd` - Test USDC
- `ytest.eth` - Test ETH
- `ytest.btc` - Test BTC

---

## Technical Decisions

### Why Yellow Network?

**Considered Alternatives:**
- Optimistic Rollups (Optimism, Arbitrum)
- zkRollups (zkSync, StarkNet)
- Plasma (OMG Network)
- State Channels (Connext, Nitro Protocol)

**Chose Yellow Network Because:**
- ✅ ERC-7824 standard compliance
- ✅ Instant finality (no confirmation delays)
- ✅ Gasless transactions for users
- ✅ Unified balance across apps
- ✅ Built-in App Session framework
- ✅ Active development and support

**Trade-offs:**
- ❌ Newer ecosystem (less mature than Optimism)
- ❌ Requires ClearNet connection
- ❌ Limited mainnet availability (currently sandbox)
- ❌ Steeper learning curve

### Why App Sessions Instead of Direct Contracts?

**App Sessions Advantages:**
- Off-chain state updates (gasless)
- Flexible participant weights
- Built-in challenge period
- Easy fund distribution
- Unified balance integration

**Direct Contracts Advantages:**
- More control over logic
- Fully decentralized
- No dependency on Yellow Network
- Standard Solidity patterns

**Decision:** App Sessions fit prediction markets perfectly - they're designed for multi-party fund pooling with resolution logic.

### Why Simple AMM Pricing?

**Decision:** Start with simple ratio formula, upgrade later

**Rationale:**
- Faster to implement
- Easier to understand for users
- Good enough for MVP
- Can upgrade without breaking existing markets

**Formula:**
```typescript
yesPrice = (yes_amount / total_volume) * 100
noPrice = 100 - yesPrice
```

**Future:** Implement CPMM for production.

### Why Server-Side Oracle?

**Considered Alternatives:**
- Chainlink oracle
- UMA Optimistic Oracle
- Client-side resolution
- Decentralized oracle network (DON)

**Chose Server-Side Because:**
- ✅ Simplest to implement
- ✅ Direct Twitch API access
- ✅ No oracle fees
- ✅ Instant resolution
- ✅ Full control over logic

**Trade-offs:**
- ❌ Centralized (single point of failure)
- ❌ Requires trust in oracle operator
- ❌ No on-chain verification

**Future:** Migrate to UMA or Chainlink for production.

### Why Supabase + Yellow Network Hybrid?

**Architecture:** Supabase for state, Yellow Network for funds

**Rationale:**
- Supabase: Fast queries, complex filtering, UI state
- Yellow Network: Secure fund custody, instant transfers
- Best of both worlds

**Data Flow:**
1. Market metadata → Supabase
2. Bet amounts → Yellow App Session
3. Sync pool totals → Supabase (for display)
4. Resolution → Supabase status, Yellow distribution

---

## Resources

### Official Documentation

- **Yellow Network Docs:** https://docs.yellow.org
- **Nitrolite SDK:** https://github.com/erc7824/nitrolite
- **yellow-ts Library:** https://github.com/stevenzeiler/yellow-ts
- **ERC-7824 Specification:** https://erc7824.org
- **Twitch API Reference:** https://dev.twitch.tv/docs/api
- **Supabase Docs:** https://supabase.com/docs

### Project Files Reference

**Core Implementation:**
- `/lib/yellow/client.ts` - Yellow Network client wrapper
- `/lib/yellow/oracle.ts` - Twitch oracle and resolution logic
- `/lib/yellow/types.ts` - TypeScript type definitions

**API Routes:**
- `/app/api/markets/create/route.ts` - Manual market creation
- `/app/api/markets/auto-create/route.ts` - Automated market generation
- `/app/api/markets/bet/route.ts` - Bet placement
- `/app/api/markets/claim/route.ts` - Winnings claim
- `/app/api/oracle/run/route.ts` - Oracle automation

**Components:**
- `/components/market-card.tsx` - Market display card
- `/components/bet-button.tsx` - Betting dialog
- `/components/create-market-form.tsx` - Market creation form
- `/components/claim-winnings-button.tsx` - Claim interface
- `/components/providers/yellow-provider.tsx` - Global Yellow state

**Database:**
- `/supabase/migrations/20260206154039_add_yellow_network_fields.sql`
- `/types/database.ts` - TypeScript database types

### Community & Support

- **Yellow Network Discord:** https://discord.gg/yellow
- **GitHub Issues:** File issues in this repository
- **Stack Overflow:** Tag with `yellow-network` and `erc7824`

### Related Projects

- **Polymarket:** https://polymarket.com (inspiration)
- **Augur:** https://augur.net (prediction market protocol)
- **Gnosis:** https://gnosis.io (conditional tokens)
- **UMA:** https://umaproject.org (optimistic oracle)

---

**Document Version:** 1.0
**Created:** February 7, 2026
**Authors:** Development Team
**Status:** Living Document - Update as implementation progresses