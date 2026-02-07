# Yellow Network Integration - Implementation Guide

## ✅ Completed Components

### 1. YellowClient Extended (`lib/yellow/client.ts`)
- ✅ **Deposit to Unified Balance** - `depositToUnifiedBalance(asset, amount)`
- ✅ **Withdraw from Unified Balance** - `withdrawFromUnifiedBalance(asset, amount, destination)`
- ✅ **Create App Session** - `createAppSession(request)` - Creates prediction market session
- ✅ **Submit Bet** - `submitBet(appSessionId, poolAddress, asset, amount, allocations)` - Uses DEPOSIT intent
- ✅ **Get App Definition** - `getAppDefinition(appSessionId)` - Reads current allocations
- ✅ **Get App Sessions** - `getAppSessions(participant, status)` - Lists all sessions
- ✅ **Close App Session** - `closeAppSession(appSessionId, finalAllocations)` - Distributes funds
- ✅ **Calculate Odds** - `calculateOdds(allocations)` - Dynamic price calculation

### 2. Twitch Oracle (`lib/yellow/oracle.ts`)
- ✅ **Get Twitch Metric** - Fetches followers_count, viewer_count from Twitch API
- ✅ **Resolve Market** - Compares actual vs target value, determines winner
- ✅ **Distribute Winnings** - Closes App Session with final allocations
- ✅ **Close Expired Markets** - Auto-closes markets past end_date
- ✅ **Process Closed Markets** - Batch processes all closed markets
- ✅ **Run Oracle Cycle** - Complete automation loop

### 3. Oracle API Endpoint (`app/api/oracle/run/route.ts`)
- ✅ **POST /api/oracle/run** - Triggers oracle cycle
- ✅ **GET /api/oracle/run** - Health check
- ✅ **Authentication** - Bearer token protection
- ⚠️ **Note:** Requires `ORACLE_WALLET_ADDRESS`, `ORACLE_PRIVATE_KEY`, `ORACLE_API_SECRET` in `.env`

### 4. Profile Component Updates (`components/profile-content.tsx`)
- ✅ **Yellow Network Card** - Displays Unified Balance
- ✅ **Deposit Dialog** - Transfer funds to Yellow Network
- ✅ **Withdraw Dialog** - Withdraw to wallet
- ✅ **Real-time Balance** - Syncs with YellowProvider
- ✅ **Connection Status Badge** - Shows authenticated/connected state

---

## ⚠️ Database Schema Changes Required

The following columns need to be added to the `markets` table in Supabase:

```sql
-- Add Yellow Network fields to markets table
ALTER TABLE markets
ADD COLUMN app_session_id TEXT,
ADD COLUMN pool_yes_address TEXT,
ADD COLUMN pool_no_address TEXT,
ADD COLUMN oracle_address TEXT,
ADD COLUMN yes_amount TEXT DEFAULT '0',
ADD COLUMN no_amount TEXT DEFAULT '0',
ADD COLUMN twitch_metric TEXT DEFAULT 'viewer_count',
ADD COLUMN target_value INTEGER DEFAULT 10000,
ADD COLUMN winner TEXT CHECK (winner IN ('yes', 'no'));

-- Add indexes for performance
CREATE INDEX idx_markets_app_session_id ON markets(app_session_id);
CREATE INDEX idx_markets_status ON markets(status);
```

After running this migration, update `types/database.ts`:

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
  // ... Insert and Update should also include these fields
}
```

---

## 🔧 Pending Implementation

### 1. Market Creation with App Sessions

Update `app/streamer/[slug]/page.tsx` (line 102):

```typescript
// Current: Simple Supabase insert
const { error: insertError } = await supabase.from('markets').insert({
  streamer_id: upsertedStreamer.id,
  question: `Will ${upsertedStreamer.name} reach 10k viewers today?`,
  // ...
});

// TODO: Add Yellow Network App Session creation
const yellowClient = new YellowClient();
await yellowClient.connect();
await yellowClient.authenticate(walletAddress, walletSigner);

const appSessionId = await yellowClient.createAppSession({
  definition: {
    protocol: 'NitroRPC/0.4',
    participants: [poolYesAddress, poolNoAddress, oracleAddress],
    weights: [0, 0, 100], // Oracle controls
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

// Then insert to Supabase with app_session_id
```

### 2. Betting with Yellow Network

Update `components/market-detail.tsx` (line 86-146):

```typescript
// Replace current Supabase-only logic with Yellow Network integration

import { useYellow } from '@/components/providers/yellow-provider';

const { client } = useYellow();

const handlePlaceBet = async () => {
  // ... validation

  if (!market.app_session_id) {
    // Fallback to old Supabase-only method
    // ... current implementation
    return;
  }

  // Use Yellow Network App Session
  const poolAddress = selectedOutcome === 'yes'
    ? market.pool_yes_address
    : market.pool_no_address;

  await client.submitBet(
    market.app_session_id,
    poolAddress,
    'ytest.usd',
    (betAmount * 1_000_000).toString(), // Convert to smallest unit
    currentAllocations
  );

  // Update Supabase for tracking
  await supabase.from('transactions').insert({
    user_id: user.id,
    type: 'bet',
    amount: betAmount,
    yellow_tx_id: txId, // Store Yellow Network transaction ID
  });

  // Refresh market odds from Yellow Network
  const appDef = await client.getAppDefinition(market.app_session_id);
  const { yesPrice, noPrice } = client.calculateOdds(appDef.allocations);

  await supabase.from('markets').update({
    yes_price: yesPrice,
    no_price: noPrice,
    yes_amount: appDef.allocations[0].amount,
    no_amount: appDef.allocations[1].amount,
  }).eq('id', market.id);

  router.refresh();
};
```

### 3. Dynamic Odds from Yellow Network

Create a polling mechanism or use WebSocket subscriptions to update market odds in real-time:

```typescript
// In market detail page or component
useEffect(() => {
  if (!market.app_session_id || !client) return;

  const updateOdds = async () => {
    const appDef = await client.getAppDefinition(market.app_session_id);
    const { yesPrice, noPrice } = client.calculateOdds(appDef.allocations);

    // Update local state or Supabase
  };

  const interval = setInterval(updateOdds, 30000); // Every 30 seconds
  return () => clearInterval(interval);
}, [market.app_session_id, client]);
```

### 4. Oracle Automation

**Option A: Vercel Cron (Recommended)**

Create `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/oracle/run",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

**Option B: External Cron Service**

Use a service like cron-job.org to call:
```bash
curl -X POST https://your-domain.com/api/oracle/run \
  -H "Authorization: Bearer YOUR_ORACLE_API_SECRET"
```

**Option C: Supabase Edge Function**

Deploy oracle as a Supabase Edge Function with pg_cron trigger.

---

## 🔐 Environment Variables Needed

Add to `.env.local`:

```bash
# Oracle Configuration
ORACLE_WALLET_ADDRESS=0x... # Server-side wallet that controls oracle
ORACLE_PRIVATE_KEY=0x... # Private key for oracle wallet (KEEP SECRET!)
ORACLE_API_SECRET=your-secret-token-here # For protecting /api/oracle/run

# Pool Addresses (generate or use existing)
POOL_YES_ADDRESS=0x...
POOL_NO_ADDRESS=0x...
```

---

## 🧪 Testing Checklist

### Profile Page
- [ ] Yellow Network card displays Unified Balance
- [ ] Deposit dialog opens and accepts input
- [ ] Deposit transaction succeeds and balance updates
- [ ] Withdraw dialog opens and accepts input
- [ ] Withdraw transaction succeeds and balance updates
- [ ] Connection status badge shows correct state

### Market Creation (After DB Migration)
- [ ] New market creates App Session on Yellow Network
- [ ] `app_session_id` is saved to database
- [ ] Pool addresses are set correctly
- [ ] Initial allocations are all 0

### Betting (After Implementation)
- [ ] Bet uses DEPOSIT intent to Yellow Network
- [ ] App Session allocations update correctly
- [ ] Market odds recalculate based on new allocations
- [ ] Supabase transaction log is created
- [ ] User balance updates appropriately

### Oracle
- [ ] GET /api/oracle/run returns status
- [ ] POST /api/oracle/run requires authentication
- [ ] Expired markets are closed automatically
- [ ] Closed markets are resolved with correct winner
- [ ] Funds are distributed to winning pool
- [ ] Market status updates to 'resolved'

---

## 📊 Current Flow vs Target Flow

### Current (Supabase Only)
```
User → Place Bet → Update Supabase DB → Recalculate odds locally → Refresh page
```

### Target (Yellow Network)
```
User → Connect Wallet → Authenticate Yellow → Deposit to Unified Balance
                                                      ↓
Market Created → App Session on Yellow Network → Allocations [YES: 0, NO: 0]
                                                      ↓
User Places Bet → DEPOSIT intent → Transfer from Unified Balance → App Session
                                                      ↓
                                          Update allocations [YES: 1000, NO: 500]
                                                      ↓
                                          Recalculate odds: YES=66.6%, NO=33.3%
                                                      ↓
Market Ends → Oracle closes market → Oracle verifies Twitch API → Determine winner
                                                      ↓
                                    Close App Session → Distribute to winning pool
                                                      ↓
                                    Funds back to Unified Balance → Users withdraw
```

---

## 🚀 Deployment Recommendations

1. **Deploy Database Changes First**
   ```bash
   # Run SQL migration on Supabase
   # Update types/database.ts
   ```

2. **Configure Environment Variables**
   ```bash
   # Add oracle wallet and secrets
   # Generate pool addresses
   ```

3. **Deploy Updated Code**
   ```bash
   npm run build
   git add .
   git commit -m "feat: Yellow Network integration complete"
   git push
   ```

4. **Set Up Oracle Automation**
   ```bash
   # Configure Vercel Cron or external service
   ```

5. **Test End-to-End**
   - Create test market
   - Place test bets
   - Wait for market to close
   - Trigger oracle manually
   - Verify funds distributed

---

## 📝 Notes

- **Testnet Only**: Currently configured for Sepolia testnet and Yellow Network sandbox
- **Security**: Never commit oracle private keys to git
- **Performance**: Consider caching App Session definitions to reduce Yellow Network calls
- **Error Handling**: All Yellow Network calls have try-catch blocks
- **Backwards Compatibility**: Markets without `app_session_id` will use old Supabase-only flow

---

## 🐛 Known Limitations

1. **No User-Specific Bet Tracking in App Sessions** - Yellow Network App Sessions track total pool amounts, not individual user bets. You'll need to maintain user bet records in Supabase for payout calculations.

2. **Oracle Wallet Security** - The oracle wallet must be secured server-side. Consider using AWS KMS, HashiCorp Vault, or similar for production.

3. **Gas Costs** - While App Session operations are off-chain (gasless), opening/closing sessions may require on-chain transactions depending on configuration.

4. **Race Conditions** - Multiple simultaneous bets could cause allocation conflicts. Implement optimistic locking or queuing for production.

5. **WebSocket Reconnection** - YellowClient should implement auto-reconnect logic for production reliability.

---

## 📚 Resources

- [Yellow Network Docs](https://docs.yellow.org/)
- [Nitrolite SDK](https://github.com/erc7824/nitrolite)
- [ERC-7824 Specification](https://erc7824.org/)
- [Twitch API Reference](https://dev.twitch.tv/docs/api/)
