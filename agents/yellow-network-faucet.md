# Yellow Network Sandbox Faucet

## Getting Test Tokens (ytest.usd)

The Yellow Network sandbox provides a faucet endpoint to get free test tokens for development.

### Faucet Endpoint

```bash
curl -XPOST https://clearnet-sandbox.yellow.com/faucet/requestTokens \
  -H "Content-Type: application/json" \
  -d '{"userAddress":"<your_wallet_address>"}'
```

### Response

The faucet will credit your account with `ytest.usd` tokens that can be used in the Yellow Network sandbox environment.

### Token Details

- **Asset**: `ytest.usd`
- **Network**: Yellow Network Sandbox
- **WebSocket URL**: `wss://clearnet-sandbox.yellow.com/ws`
- **Amount**: Usually provides 10,000,000 units (10 tokens with 6 decimals)

### Usage in Application

After requesting tokens from the faucet:

1. Connect to Yellow Network
2. Authenticate with your wallet
3. Check balance using `fetchUnifiedBalance()`
4. Your `ytest.usd` balance should show the credited amount

### Important Notes

- This faucet is only for the **sandbox environment**
- Test tokens have no real value
- Used for testing Yellow Network features like state channels, transfers, and app sessions
- The amount format uses 6 decimal places (like USDC)
  - `10000010` = 10.000010 ytest.usd
  - `1000000` = 1.0 ytest.usd
  - `100000` = 0.1 ytest.usd