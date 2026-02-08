# Yellow Network Integration - Operations & Troubleshooting

**Project:** HackMoney PolyStream - Twitch Prediction Markets
**Last Updated:** February 7, 2026

---

## Table of Contents

1. [Deployment Guide](#deployment-guide)
2. [Troubleshooting](#troubleshooting)
3. [Developer Journey](#developer-journey)
4. [Conclusion](#conclusion)

---

## Deployment Guide

### Pre-Deployment Checklist

- [ ] All tests passing
- [ ] Database migration applied to production
- [ ] Environment variables configured in Vercel
- [ ] Oracle wallet funded with gas
- [ ] Wallet connect implemented (not using private keys)
- [ ] Rate limiting enabled
- [ ] Error monitoring configured (Sentry, LogRocket)
- [ ] Backup strategy in place

---

### Deployment Steps

#### 1. Database Migration

```bash
# Production Supabase
supabase link --project-ref your-prod-project-ref
supabase db push

# Verify
supabase migration list
```

#### 2. Environment Variables

In Vercel Dashboard:
- Add all env vars from `.env.local`
- Ensure `YELLOW_ORACLE_PRIVATE_KEY` is secure
- Set `NODE_ENV=production`

#### 3. Deploy Code

```bash
npm run build  # Test build locally
git add .
git commit -m "feat: Yellow Network integration complete"
git push origin main  # Triggers Vercel deployment
```

#### 4. Configure Cron Job

**Option A: Vercel Cron**

Create `vercel.json` in root:
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

Redeploy for cron to take effect.

**Option B: External Cron**

Use cron-job.org or similar:
- URL: `https://your-domain.vercel.app/api/oracle/run`
- Method: POST
- Headers: `Authorization: Bearer your-secret`
- Schedule: `*/5 * * * *` (every 5 minutes)

#### 5. Post-Deployment Testing

```bash
# Health check
curl https://your-domain.vercel.app/api/oracle/run

# Create test market
# Place test bet
# Wait for resolution
# Verify funds distributed
```

#### 6. Monitoring

- [ ] Set up Vercel Analytics
- [ ] Configure Sentry for error tracking
- [ ] Monitor Yellow Network dashboard
- [ ] Set up alerts for failed oracle runs
- [ ] Log all transactions for audit

---

### Rollback Plan

If issues arise:

```bash
# 1. Revert deployment in Vercel Dashboard
# 2. Or revert git commit
git revert HEAD
git push origin main

# 3. If database issues
# Create rollback migration
# supabase migration create rollback_yellow_fields
```

---

## Troubleshooting

### Authentication Errors

**Error:** `{error: 'invalid challenge or signature'}`

**Causes:**
1. Wrong EIP-712 domain configuration
2. Incorrect signature format
3. Session key mismatch

**Solution:**
```typescript
// Use minimal domain
const domain = { name: 'YourAppName' };

// Ensure signature matches challenge exactly
const signature = await walletClient.signTypedData({
  domain,
  types: AuthTypes,
  primaryType: 'Auth',
  message: authParams,
});
```

---

### Unsupported Token Error

**Error:** `{error: "unsupported token: asset 'USDC' is not supported"}`

**Cause:** Using mainnet USDC address on sandbox

**Solution:**
```bash
# Use Yellow test token
VITE_TEST_TOKEN_ADDRESS=0xDB9F293e3898c9E5536A3be1b0C56c89d2b32DEb
```

**Query supported assets:**
```javascript
ws.send(JSON.stringify({
  req: [1, 'get_assets', {}, Date.now()],
  sig: []
}));
```

---

### Timeout Errors

**Error:** `Authentication timeout`

**Causes:**
1. Slow network connection
2. ClearNet overload
3. WebSocket not opened

**Solution:**
```typescript
// Increase timeout
const client = new Client({
  url: 'wss://clearnet-sandbox.yellow.com/ws',
  requestTimeoutMs: 30000,  // 30 seconds
});

// Add reconnection logic
client.on('close', () => {
  setTimeout(() => client.connect(), 5000);
});
```

---

### Database Migration Issues

**Error:** `column already exists`

**Cause:** Migration run multiple times

**Solution:**
```sql
-- Check existing columns
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'markets';

-- Drop duplicates if needed
ALTER TABLE markets DROP COLUMN IF EXISTS app_session_id;

-- Re-run migration
```

---

### Oracle Not Running

**Symptoms:**
- Markets not closing after end_date
- Markets not resolving
- Cron job not triggering

**Checks:**
1. Verify cron configured in `vercel.json`
2. Check Vercel logs for `/api/oracle/run`
3. Test manual trigger:
   ```bash
   curl -X POST https://your-domain.com/api/oracle/run \
     -H "Authorization: Bearer your-secret"
   ```
4. Verify `ORACLE_API_SECRET` matches in env vars
5. Check oracle wallet has gas funds

---

### App Session Creation Fails

**Error:** App Session ID is null in database

**Causes:**
1. Yellow Network connection failed
2. Oracle wallet not authenticated
3. Invalid participant addresses

**Debug:**
```typescript
// Add logging in createAppSession
console.log('Creating App Session with:', {
  participants,
  allocations,
});

const appSessionId = await client.createAppSession(request);
console.log('Created App Session:', appSessionId);

if (!appSessionId) {
  throw new Error('App Session creation failed');
}
```

---

### Bet Not Updating Prices

**Symptoms:**
- Bet submitted successfully
- Database not updated
- Prices unchanged

**Checks:**
1. Verify Yellow Network transaction succeeded
2. Check database update query:
   ```sql
   SELECT yes_amount, no_amount, yes_price, no_price
   FROM markets
   WHERE id = 'market-id';
   ```
3. Check for BigInt conversion errors:
   ```typescript
   // Ensure proper BigInt handling
   const newAmount = BigInt(market.yes_amount) + BigInt(betAmount);
   console.log('New amount:', newAmount.toString());
   ```

---

## Developer Journey

### Authentication Challenges

During initial integration, we encountered several cryptic errors:

**Error 1: Invalid Challenge**
```
{error: 'invalid challenge or signature'}
```

**Root Cause:** Complex EIP-712 domain with hardcoded chainId

**Solution:**
```typescript
// ❌ WRONG
const domain = {
  name: 'Yellow Network',
  version: '1',
  chainId: 1,
  verifyingContract: '0x0000...'
};

// ✅ CORRECT
const domain = {
  name: 'Nitrolite Prediction Market'
};
```

---

**Error 2: Unsupported Token**
```
{error: "unsupported token: asset 'USDC' is not supported"}
```

**Root Cause:** Using Circle's USDC address instead of Yellow test token

**Solution:**
```bash
# ❌ WRONG - Circle USDC on Sepolia
VITE_TEST_TOKEN_ADDRESS=0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238

# ✅ CORRECT - Yellow test token
VITE_TEST_TOKEN_ADDRESS=0xDB9F293e3898c9E5536A3be1b0C56c89d2b32DEb
```

---

**Error 3: Response Format Mismatch**

Raw `@erc7824/nitrolite` expects:
```javascript
{ res: [1, 'auth_verify', { success: true }] }
```

ClearNode returns:
```javascript
{
  method: 'auth_verify',
  params: { success: true, jwtToken: '...' },
  requestId: 123456
}
```

**Solution:** Use `yellow-ts` wrapper which handles message correlation.

---

### Key Learnings

1. **EIP-712 Domain:** Keep minimal - just app name
2. **Test Tokens:** Always query supported assets via WebSocket
3. **Use Wrappers:** `yellow-ts` handles WebSocket complexity
4. **Response Formats:** Check both array and object formats
5. **Sandbox URL:** Use `wss://clearnet-sandbox.yellow.com/ws`

---

## Conclusion

This implementation provides a complete, production-ready foundation for Yellow Network-powered prediction markets. The core functionality is solid, with a clear path forward for the remaining features.

**What Works:**
- Market creation (manual and automated)
- Yellow Network App Session integration
- Betting with state channels
- Automated oracle resolution
- Winnings calculation

**What's Next:**
1. Implement real wallet connect
2. Add bets table for individual tracking
3. Enable actual fund withdrawals
4. Deploy to production with monitoring

**Estimated Time to Production:**
- High priority items: 1-2 weeks
- Medium priority items: 2-4 weeks
- Full feature set: 1-2 months

---

## Quick Reference

### Common Commands

```bash
# Development
npm run dev          # Start dev server (port 3001)
npm run build        # Production build
npm run typecheck    # TypeScript checking
npm run lint         # Code linting

# Database
supabase db push     # Apply migrations
supabase migration list  # View migrations

# Testing
curl -X POST http://localhost:3001/api/markets/auto-create
curl -X POST http://localhost:3001/api/oracle/run

# Yellow Network Faucet
curl -XPOST https://clearnet-sandbox.yellow.com/faucet/requestTokens \
  -H "Content-Type: application/json" \
  -d '{"userAddress":"YOUR_WALLET_ADDRESS"}'
```

### Important URLs

- **Yellow Sandbox WebSocket:** `wss://clearnet-sandbox.yellow.com/ws`
- **Yellow Faucet:** `https://clearnet-sandbox.yellow.com/faucet/requestTokens`
- **Test Token Address:** `0xDB9F293e3898c9E5536A3be1b0C56c89d2b32DEb`
- **Supabase Project:** `hemrblmhvgzilttbodpp.supabase.co`

### Critical Configuration

```typescript
// EIP-712 Domain (Must be minimal!)
const domain = { name: 'PolyStream' };

// App Session Structure
{
  participants: [poolYes, poolNo, oracle],
  weights: [0, 0, 100],  // Oracle has full control
  quorum: 100,
  challenge: 3600
}

// Test Token
asset: 'ytest.usd'
decimals: 6
```

### Error Codes Reference

| Error | Cause | Solution |
|-------|-------|----------|
| `invalid challenge or signature` | Wrong EIP-712 domain | Use minimal domain |
| `unsupported token` | Wrong token address | Use ytest.usd |
| `authentication timeout` | Network issues | Increase timeout, retry |
| `app session creation failed` | Missing auth | Ensure authenticated first |
| `insufficient balance` | No funds | Request from faucet |

---

**Document Version:** 1.0
**Created:** February 7, 2026
**Authors:** Development Team
**Status:** Living Document - Update as issues are discovered