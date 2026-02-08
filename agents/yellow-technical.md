# Yellow Network Integration - Technical Implementation

**Project:** HackMoney PolyStream - Twitch Prediction Markets
**Last Updated:** February 7, 2026

---

## Table of Contents

1. [Core Components](#core-components)
2. [API Endpoints](#api-endpoints)
3. [User Flows](#user-flows)
4. [Testing Guide](#testing-guide)
5. [Pending Items](#pending-items)
6. [Known Issues](#known-issues)

---

## Core Components

### 1. YellowClient (`lib/yellow/client.ts`)

Complete Yellow Network integration wrapper.

#### Key Methods

**Connection & Authentication**

```typescript
const client = new YellowClient();
await client.connect();
await client.authenticate(walletAddress, walletSigner);
```

**Unified Balance Operations**

```typescript
// Deposit from L1 to Yellow Network
await client.depositToUnifiedBalance('ytest.usd', '1000000'); // 1 USDC

// Withdraw to wallet
await client.withdrawFromUnifiedBalance('ytest.usd', '500000', userAddress);

// Check balance
const balance = await client.getUnifiedBalance('ytest.usd');
```

**App Session Management**

```typescript
// Create prediction market App Session
const appSessionId = await client.createAppSession({
  definition: {
    protocol: 'NitroRPC/0.4',
    participants: [poolYesAddress, poolNoAddress, oracleAddress],
    weights: [0, 0, 100], // Oracle has full control
    quorum: 100,
    challenge: 3600,
    nonce: Date.now(),
  },
  allocations: [
    { participant: poolYesAddress, asset: 'ytest.usd', amount: '0' },
    { participant: poolNoAddress, asset: 'ytest.usd', amount: '0' },
    { participant: oracleAddress, asset: 'ytest.usd', amount: '0' },
  ],
});

// Submit bet (DEPOSIT intent)
await client.submitBet(
  appSessionId,
  poolYesAddress,  // or poolNoAddress
  'ytest.usd',
  '10000000',  // 10 USDC
  currentAllocations
);

// Close and distribute
await client.closeAppSession(appSessionId, finalAllocations);
```

**Odds Calculation**

```typescript
const { yesPrice, noPrice } = client.calculateOdds([
  { participant: poolYes, amount: '66000000' },
  { participant: poolNo, amount: '34000000' },
  { participant: oracle, amount: '0' },
]);
// Result: yesPrice = 66%, noPrice = 34%
```

#### Configuration

**Sandbox Environment:**
- URL: `wss://clearnet-sandbox.yellow.com/ws`
- Test Token: `ytest.usd` (0xDB9F293e3898c9E5536A3be1b0C56c89d2b32DEb)
- Decimals: 6 (same as USDC)

**EIP-712 Domain:**
```typescript
const domain = {
  name: 'Nitrolite Prediction Market'  // Minimal domain - critical!
};
```

---

### 2. Twitch Oracle (`lib/yellow/oracle.ts`)

Automated market resolution system.

#### Oracle Cycle

```typescript
export async function runOracleCycle() {
  const results = {
    closedCount: 0,
    resolvedCount: 0,
    errors: [],
  };

  // Step 1: Close expired markets
  results.closedCount = await closeExpiredMarkets();

  // Step 2: Resolve closed markets
  const resolvedMarkets = await processClosedMarkets();
  results.resolvedCount = resolvedMarkets.length;

  return results;
}
```

#### Resolution Logic

```typescript
export async function resolveMarket(market: Market): Promise<'yes' | 'no'> {
  // Fetch Twitch metric
  const actualValue = await getTwitchMetric(
    market.streamer.twitch_id,
    market.twitch_metric
  );

  // Compare with target
  const winner = actualValue >= market.target_value ? 'yes' : 'no';

  // Update database
  await supabase
    .from('markets')
    .update({ winner, status: 'resolved' })
    .eq('id', market.id);

  // Distribute funds
  await distributeWinnings(market, winner);

  return winner;
}
```

#### Fund Distribution

```typescript
async function distributeWinnings(market: Market, winner: 'yes' | 'no') {
  const totalPool = BigInt(market.yes_amount) + BigInt(market.no_amount);

  const finalAllocations = [
    {
      participant: market.pool_yes_address,
      asset: 'ytest.usd',
      amount: winner === 'yes' ? totalPool.toString() : '0',
    },
    {
      participant: market.pool_no_address,
      asset: 'ytest.usd',
      amount: winner === 'no' ? totalPool.toString() : '0',
    },
    {
      participant: market.oracle_address,
      asset: 'ytest.usd',
      amount: '0',  // Oracle takes no fee (for now)
    },
  ];

  await yellowClient.closeAppSession(market.app_session_id, finalAllocations);
}
```

---

### 3. Market Creation

#### Automatic Creation (`app/api/markets/auto-create/route.ts`)

**Process:**
1. Scan live Twitch streams
2. Filter for tracked streamers
3. Check for existing active markets
4. Generate market templates based on current metrics
5. Create Yellow Network App Session
6. Save to database

**Templates:**

```typescript
// Viewer Count Market
{
  question: `Will ${streamer.name} reach ${targetViewers.toLocaleString()} viewers?`,
  twitch_metric: 'viewer_count',
  target_value: Math.max(currentViewers * 2, 1000),
  duration: 6 hours
}

// Follower Count Market
{
  question: `Will ${streamer.name} gain ${followerGain} followers?`,
  twitch_metric: 'followers_count',
  target_value: currentFollowers + Math.max(currentFollowers * 0.05, 500),
  duration: 24 hours
}
```

**Example Request:**

```bash
curl -X POST http://localhost:3001/api/markets/auto-create
```

**Example Response:**

```json
{
  "success": true,
  "marketsCreated": 5,
  "markets": [
    {
      "id": "uuid-1",
      "question": "Will TheBurntPeanut reach 10,000 viewers?",
      "app_session_id": "0x1234...",
      "target_value": 10000
    }
  ]
}
```

#### Manual Creation (`app/api/markets/create/route.ts`)

**Form Fields:**
- Streamer selection (dropdown)
- Custom question (text)
- Twitch metric (viewer_count or followers_count)
- Target value (number)
- End date (datetime picker)

**Validation (Zod Schema):**

```typescript
const createMarketSchema = z.object({
  streamerId: z.string().uuid(),
  question: z.string().min(10).max(200),
  twitchMetric: z.enum(['viewer_count', 'followers_count']),
  targetValue: z.number().int().positive(),
  endDate: z.string().datetime(),
});
```

**API Request:**

```bash
curl -X POST http://localhost:3001/api/markets/create \
  -H "Content-Type: application/json" \
  -d '{
    "streamerId": "uuid-123",
    "question": "Will xQc hit 100k viewers during this stream?",
    "twitchMetric": "viewer_count",
    "targetValue": 100000,
    "endDate": "2026-02-08T00:00:00Z"
  }'
```

---

### 4. Betting System

#### BetButton Component (`components/bet-button.tsx`)

**Features:**
- Opens dialog on click
- Shows current price and potential return
- Validates user input
- Connects Yellow Network wallet
- Submits bet via API
- Refreshes market data

**User Flow:**

1. User clicks "Buy YES" or "Buy NO"
2. Dialog opens with:
   - Current price (e.g., "YES: 67%")
   - Amount input (USDC)
   - Potential return calculation
   - Confirm button
3. If not connected → Connect wallet flow
4. User enters amount and confirms
5. Transaction processes via Yellow Network
6. Success message and page refresh

**Code Example:**

```typescript
<BetButton
  marketId={market.id}
  outcome="yes"
  currentPrice={market.yes_price}
  disabled={market.status !== 'active'}
/>
```

#### Bet API (`app/api/markets/bet/route.ts`)

**Request:**

```typescript
{
  marketId: string;
  outcome: 'yes' | 'no';
  amount: number;  // USDC amount
}
```

**Process:**

```typescript
// 1. Validate market is active
const market = await getMarket(marketId);
if (market.status !== 'active') throw new Error('Market closed');

// 2. Initialize Yellow Client
const yellowClient = new YellowClient();
await yellowClient.connect();
await yellowClient.authenticate(oracleAddress, oracleSigner);

// 3. Submit bet via DEPOSIT intent
const poolAddress = outcome === 'yes'
  ? market.pool_yes_address
  : market.pool_no_address;

await yellowClient.submitBet(
  market.app_session_id,
  poolAddress,
  'ytest.usd',
  (amount * 1_000_000).toString()
);

// 4. Update database
const newYesAmount = outcome === 'yes'
  ? BigInt(market.yes_amount) + BigInt(amount * 1_000_000)
  : BigInt(market.yes_amount);

const newNoAmount = outcome === 'no'
  ? BigInt(market.no_amount) + BigInt(amount * 1_000_000)
  : BigInt(market.no_amount);

// 5. Recalculate prices
const totalVolume = newYesAmount + newNoAmount;
const yesPrice = Number(newYesAmount * 100n / totalVolume);
const noPrice = 100 - yesPrice;

// 6. Save to database
await supabase.from('markets').update({
  yes_amount: newYesAmount.toString(),
  no_amount: newNoAmount.toString(),
  yes_price: yesPrice,
  no_price: noPrice,
}).eq('id', marketId);
```

---

### 5. Claim Winnings

#### ClaimWinningsButton (`components/claim-winnings-button.tsx`)

**Visibility:**
- Only shows on resolved markets
- Only shows for users who bet on winning side

**Calculation:**

```typescript
function calculateWinnings(userBet: Bet, market: Market): number {
  const totalWinningPool = market.winner === 'yes'
    ? BigInt(market.yes_amount)
    : BigInt(market.no_amount);

  const totalPool = BigInt(market.yes_amount) + BigInt(market.no_amount);

  const userShare = (BigInt(userBet.amount) * totalPool) / totalWinningPool;

  return Number(userShare) / 1_000_000; // Convert to USDC
}
```

**Current Status:**
- ✅ Calculates winnings correctly
- ✅ Shows success message
- ❌ Does not withdraw funds (needs implementation)

**TODO: Actual Withdrawal**

```typescript
// In app/api/markets/claim/route.ts
const yellowClient = new YellowClient();
await yellowClient.connect();
await yellowClient.authenticate(oracleAddress, oracleSigner);

// Withdraw from winning pool to user
await yellowClient.withdraw({
  appSessionId: market.app_session_id,
  from: winningPoolAddress,
  to: userAddress,
  amount: userWinnings.toString(),
});

// Mark as claimed
await supabase.from('bets').update({
  claimed: true,
  claim_amount: userWinnings.toString(),
}).eq('id', betId);
```

---

## API Endpoints

### `/api/markets/create`

**Method:** POST
**Auth:** Required (user session)

**Request Body:**
```json
{
  "streamerId": "uuid",
  "question": "string (10-200 chars)",
  "twitchMetric": "viewer_count" | "followers_count",
  "targetValue": 10000,
  "endDate": "2026-02-08T12:00:00Z"
}
```

**Response:**
```json
{
  "success": true,
  "market": {
    "id": "uuid",
    "app_session_id": "0x...",
    "question": "...",
    "target_value": 10000
  }
}
```

---

### `/api/markets/auto-create`

**Method:** POST
**Auth:** Optional (can be triggered by cron)

**Process:**
1. Fetches live streams from Twitch
2. Filters for tracked streamers
3. Generates markets based on current metrics
4. Creates Yellow Network App Sessions
5. Saves to database

**Response:**
```json
{
  "success": true,
  "marketsCreated": 3,
  "markets": [...]
}
```

---

### `/api/markets/bet`

**Method:** POST
**Auth:** Required (wallet signature)

**Request Body:**
```json
{
  "marketId": "uuid",
  "outcome": "yes" | "no",
  "amount": 10.0
}
```

**Response:**
```json
{
  "success": true,
  "newPrice": 67.5,
  "transactionId": "0x..."
}
```

---

### `/api/markets/claim`

**Method:** POST
**Auth:** Required (wallet signature)

**Request Body:**
```json
{
  "marketId": "uuid",
  "betId": "uuid"
}
```

**Response:**
```json
{
  "success": true,
  "amountClaimed": 15.75
}
```

---

### `/api/oracle/run`

**Method:** GET, POST
**Auth:** Bearer token (ORACLE_API_SECRET)

**GET Response:**
```json
{
  "status": "healthy",
  "uptime": 123456
}
```

**POST Response:**
```json
{
  "success": true,
  "closedCount": 5,
  "resolvedCount": 3,
  "errors": []
}
```

**Usage:**

```bash
# Manual trigger
curl -X POST http://localhost:3001/api/oracle/run \
  -H "Authorization: Bearer your-secret-token"

# Cron job (Vercel)
# Add to vercel.json:
{
  "crons": [{
    "path": "/api/oracle/run",
    "schedule": "*/5 * * * *"
  }]
}
```

---

## User Flows

### Complete Betting Flow

```
1. User visits homepage
   ↓
2. Sees active market: "Will xQc reach 50k viewers?"
   ↓
3. Clicks "Buy YES" button
   ↓
4. Dialog opens showing:
   - Current price: YES 65% / NO 35%
   - Input field: "Enter amount (USDC)"
   - Potential return: "10 USDC → 15.38 USDC if YES wins"
   ↓
5. User enters 10 USDC and clicks "Confirm"
   ↓
6. If not connected:
   - Yellow wallet connect modal appears
   - User signs EIP-712 message
   - Session key generated
   ↓
7. Bet processes:
   - API calls Yellow Network
   - DEPOSIT intent submitted
   - App Session allocations updated
   - Database updated
   ↓
8. Success message: "Bet placed! New price: YES 67%"
   ↓
9. Page refreshes with updated prices
   ↓
10. Market expires (end_date reached)
   ↓
11. Oracle runs (every 5 minutes):
   - Closes expired market
   - Fetches Twitch viewer count
   - Compares: actual (52,000) >= target (50,000)
   - Winner: YES
   - Distributes funds to pool_yes_address
   ↓
12. User returns to market page
   ↓
13. Sees: "Market Resolved: YES wins! 🎉"
   ↓
14. Clicks "Claim Winnings"
   ↓
15. Calculation: user bet 10 USDC, total YES pool 65 USDC, total pot 100 USDC
    User share: (10/65) * 100 = 15.38 USDC
   ↓
16. (TODO) Funds withdrawn from App Session to user wallet
   ↓
17. Success: "Claimed 15.38 USDC!"
```

---

### Market Creator Flow

```
1. User clicks "Create Market"
   ↓
2. Form appears with fields:
   - Select streamer (dropdown with live streamers)
   - Question: "Will [streamer] reach [metric]?"
   - Metric: viewer_count or followers_count
   - Target value: 50000
   - End date: 2026-02-08 18:00
   ↓
3. User fills form and clicks "Create"
   ↓
4. Validation:
   - Question length 10-200 chars
   - Target value > 0
   - End date in future
   ↓
5. API creates Yellow Network App Session:
   - 3 participants: pool_yes, pool_no, oracle
   - Initial allocations: [0, 0, 0]
   - Oracle has 100% weight
   ↓
6. Market saved to database with app_session_id
   ↓
7. Redirect to streamer page
   ↓
8. Market appears in "Active Markets" section
```

---

## Testing Guide

### Pre-Testing Checklist

- [ ] Database migration applied
- [ ] Environment variables configured
- [ ] Yellow Network wallet funded
- [ ] Twitch API credentials valid
- [ ] Supabase connection working

---

### Unit Tests (To Be Created)

```bash
# Test Yellow Client
- [ ] createAppSession() creates valid session
- [ ] submitBet() updates allocations
- [ ] closeAppSession() distributes correctly
- [ ] calculateOdds() returns correct percentages

# Test Oracle
- [ ] closeExpiredMarkets() closes only expired
- [ ] resolveMarket() determines correct winner
- [ ] distributeWinnings() sends to right pool
- [ ] getTwitchMetric() fetches accurate data
```

---

### Integration Tests

#### Test 1: Manual Market Creation

```bash
# 1. Create market via UI or API
curl -X POST http://localhost:3001/api/markets/create \
  -H "Content-Type: application/json" \
  -d '{
    "streamerId": "uuid",
    "question": "Will xQc reach 50k viewers?",
    "twitchMetric": "viewer_count",
    "targetValue": 50000,
    "endDate": "2026-02-08T12:00:00Z"
  }'

# Expected:
# ✅ Market created in database
# ✅ app_session_id is not null
# ✅ pool_yes_address, pool_no_address, oracle_address set
# ✅ status='active'
```

#### Test 2: Place Bet

```bash
# 1. Navigate to market in browser
# 2. Click "Buy YES"
# 3. Enter amount: 10 USDC
# 4. Confirm

# Expected:
# ✅ Dialog opens
# ✅ Wallet connect works
# ✅ Transaction succeeds
# ✅ yes_amount increases by 10000000
# ✅ Prices recalculate
# ✅ UI updates without reload needed
```

#### Test 3: Auto-Create Markets

```bash
curl -X POST http://localhost:3001/api/markets/auto-create

# Expected:
# ✅ Markets created for live streamers
# ✅ No duplicates for same streamer
# ✅ Target values calculated correctly
# ✅ All have App Session IDs
```

#### Test 4: Oracle Resolution

```bash
# 1. Manually expire a market
UPDATE markets
SET end_date = NOW() - INTERVAL '1 hour'
WHERE id = 'test-market-id';

# 2. Run oracle
curl -X POST http://localhost:3001/api/oracle/run \
  -H "Authorization: Bearer your-secret"

# Expected:
# ✅ Market status changes to 'closed'
# ✅ Winner determined correctly
# ✅ status changes to 'resolved'
# ✅ App Session closed on Yellow Network
# ✅ Funds distributed to winning pool
```

#### Test 5: Claim Winnings

```bash
# 1. After market resolved
# 2. Navigate to market page
# 3. Click "Claim Winnings"

# Expected:
# ✅ Button only shows for resolved markets
# ✅ Calculates winnings correctly
# ✅ Shows success message
# ⚠️  Withdrawal pending implementation
```

---

### Edge Cases to Test

```bash
- [ ] Bet on already closed market (should fail)
- [ ] Bet with insufficient balance (should fail)
- [ ] Resolve market without App Session (should skip)
- [ ] Claim on market not won (should fail)
- [ ] Double claim (should fail with bets table)
- [ ] Oracle run with no markets (should succeed with 0 count)
- [ ] Market creation with invalid streamer (should fail)
- [ ] Bet amount = 0 (should fail validation)
- [ ] End date in past (should fail validation)
```

---

### Performance Benchmarks

```bash
Target performance:
- [ ] Market creation: < 2 seconds
- [ ] Bet submission: < 1 second
- [ ] Oracle resolution: < 5 seconds per market
- [ ] Auto-create with 10 streams: < 30 seconds
- [ ] Page load with 50 markets: < 2 seconds
```

---

## Pending Items

### High Priority (Blocking Production)

#### 1. Real Wallet Connect Integration

**Current Issue:** Uses `YELLOW_USER_PRIVATE_KEY` from environment
**Needed:** WalletConnect v2 or similar for user wallets

**Implementation:**

```typescript
// components/providers/yellow-provider.tsx
import { useWalletConnect } from '@walletconnect/...';

const { connect, address, signMessage } = useWalletConnect();

// Replace hardcoded private key with:
const signature = await signMessage(challengeMessage);
```

**Files to Modify:**
- `components/providers/yellow-provider.tsx`
- `components/bet-button.tsx`
- `lib/yellow/client.ts`

---

#### 2. Bets Table Implementation

**Current Issue:** No individual bet tracking

**Schema:**
```sql
CREATE TABLE bets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  market_id uuid REFERENCES markets(id),
  user_address text NOT NULL,
  position text CHECK (position IN ('yes', 'no')),
  amount text NOT NULL,
  price_at_time numeric,
  created_at timestamp DEFAULT now(),
  claimed boolean DEFAULT false
);
```

**Changes Needed:**
- Create migration file
- Update `/api/markets/bet` to save bet record
- Update `/api/markets/claim` to query user bets
- Add bet history UI component

---

#### 3. Actual Fund Withdrawal in Claim

**Current Issue:** Only calculates, doesn't withdraw

**Implementation:**

```typescript
// app/api/markets/claim/route.ts
const yellowClient = new YellowClient();
await yellowClient.connect();
await yellowClient.authenticate(oraclePrivateKey);

const winningPool = market.winner === 'yes'
  ? market.pool_yes_address
  : market.pool_no_address;

await yellowClient.withdraw({
  appSessionId: market.app_session_id,
  from: winningPool,
  to: userAddress,
  amount: userWinnings.toString(),
});

await supabase.from('bets').update({
  claimed: true
}).eq('id', betId);
```

---

### Medium Priority (Post-Launch)

#### 4. Advanced AMM Pricing

**Current:** Simple ratio formula
**Needed:** Constant Product Market Maker (CPMM)

```typescript
// lib/yellow/amm.ts
export function calculateCPMMPrice(
  yesAmount: bigint,
  noAmount: bigint,
  buyAmount: bigint,
  buyYes: boolean
): { price: number; newYes: bigint; newNo: bigint } {
  const k = yesAmount * noAmount;

  const newYes = buyYes ? yesAmount + buyAmount : yesAmount;
  const newNo = buyYes ? noAmount : noAmount + buyAmount;

  // Maintain constant product
  const requiredOther = k / (buyYes ? newYes : newNo);

  return {
    price: Number(newYes * 100n / (newYes + newNo)),
    newYes,
    newNo: requiredOther,
  };
}
```

---

#### 5. WebSocket Live Updates

**Needed:** Real-time price updates without page refresh

```typescript
// hooks/use-market-updates.ts
export function useMarketUpdates(marketId: string) {
  useEffect(() => {
    const ws = new WebSocket(`wss://your-domain.com/ws/markets/${marketId}`);

    ws.onmessage = (event) => {
      const update = JSON.parse(event.data);
      // Update local state
    };

    return () => ws.close();
  }, [marketId]);
}
```

---

#### 6. User Analytics Dashboard

**Features:**
- Total bets placed
- Win/loss ratio
- Total volume traded
- Profit/loss over time
- Leaderboard position

---

#### 7. Error Handling Improvements

**Needed:**
- Rate limiting on APIs
- Retry logic for Yellow Network calls
- Better error messages to users
- Transaction receipt tracking
- Failed transaction recovery

---

### Low Priority (Nice to Have)

- [ ] Social sharing (Twitter, Discord)
- [ ] Push notifications for market resolution
- [ ] Mobile app (React Native)
- [ ] Advanced charting (price history)
- [ ] Market comments/chat
- [ ] Streamer dashboards
- [ ] Referral system
- [ ] Liquidity mining rewards

---

## Known Issues

### 1. TypeScript Types Outdated

**Issue:** Database types don't include new Yellow Network fields
**Impact:** Need to use `as any` in some places
**Solution:** Regenerate types

```bash
supabase gen types typescript --local > types/database.ts
```

---

### 2. Hardcoded Wallet

**Issue:** Uses `YELLOW_USER_PRIVATE_KEY` from environment
**Impact:** All users share same wallet (demo only)
**Solution:** Implement WalletConnect (priority 1)

---

### 3. No Individual Bet Tracking

**Issue:** Only pool totals stored, not per-user bets
**Impact:** Can't show user bet history or prevent double-claiming
**Solution:** Create `bets` table (priority 2)

---

### 4. Demo-Only Claim

**Issue:** Claim calculates but doesn't withdraw funds
**Impact:** Users can't actually receive winnings
**Solution:** Implement withdrawal (priority 3)

---

### 5. Simple Pricing Algorithm

**Issue:** Linear AMM doesn't prevent price manipulation
**Impact:** Large bets can drastically move prices
**Solution:** Implement CPMM or Uniswap-style AMM

---

### 6. No Rate Limiting

**Issue:** APIs can be spammed
**Impact:** Potential DoS, high Yellow Network costs
**Solution:** Add rate limiting middleware

```typescript
// middleware.ts
import { Ratelimit } from '@upstash/ratelimit';

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, '10 s'),
});

export async function middleware(request: Request) {
  const ip = request.headers.get('x-forwarded-for');
  const { success } = await ratelimit.limit(ip);

  if (!success) {
    return new Response('Too many requests', { status: 429 });
  }
}
```

---

### 7. Oracle Single Point of Failure

**Issue:** Single oracle wallet controls all resolutions
**Impact:** If private key compromised, all markets at risk
**Solution:** Multi-sig oracle or decentralized oracle network

---

**Document Version:** 1.0
**Created:** February 7, 2026
**Authors:** Development Team