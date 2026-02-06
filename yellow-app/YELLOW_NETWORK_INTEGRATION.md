# Integrating Yellow Network: A Developer's Journey

## The Problem

We were building a **Polymarket-style prediction market for live streamers** and chose Yellow Network for its off-chain state channels - perfect for instant, gasless betting transactions. However, integrating with Yellow Network proved challenging due to unclear documentation and subtle configuration issues.

### Initial Errors

When attempting to authenticate with Yellow Network's ClearNode, we encountered several cryptic errors:

```
Authentication error: {error: 'invalid challenge or signature'}
Authentication error: {error: "unsupported token: asset 'USDC' is not supported"}
Authentication timeout
```

## Root Causes

After extensive debugging, we identified **three main issues**:

### 1. Wrong EIP-712 Domain Configuration

The original code had a complex domain with hardcoded chainId:

```typescript
// ❌ WRONG - Too complex, wrong chainId
const domain = {
  name: 'Yellow Network',
  version: '1',
  chainId: 1,  // Hardcoded to mainnet!
  verifyingContract: '0x0000000000000000000000000000000000000000'
};
```

The Yellow Network documentation specifies a **minimal domain**:

```typescript
// ✅ CORRECT - Simple domain with just name
const domain = {
  name: 'Nitrolite Prediction Market'  // Your app name
};
```

### 2. Unsupported Token Address

We configured USDC's Sepolia address, but the **sandbox only supports specific test tokens**:

```bash
# ❌ WRONG - Circle's USDC on Sepolia (not supported)
VITE_TEST_TOKEN_ADDRESS=0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238

# ✅ CORRECT - Yellow's test token (ytest.usd)
VITE_TEST_TOKEN_ADDRESS=0xDB9F293e3898c9E5536A3be1b0C56c89d2b32DEb
```

**Pro tip:** Query supported assets via WebSocket:

```javascript
const ws = new WebSocket('wss://clearnet-sandbox.yellow.com/ws');
ws.onopen = () => {
  ws.send(JSON.stringify({
    req: [1, 'get_assets', {}, Date.now()],
    sig: []
  }));
};
```

### 3. Response Format Mismatch

The SDK expects responses in `res[0]/res[1]/res[2]` format, but ClearNode returns:

```javascript
// Expected format:
{ res: [1, 'auth_verify', { success: true }] }

// Actual format:
{
  method: 'auth_verify',
  params: { success: true, jwtToken: '...' },
  requestId: 123456
}
```

## The Solution

### Use `yellow-ts` Library

We switched from raw `@erc7824/nitrolite` to the `yellow-ts` wrapper which handles message correlation automatically:

```bash
pnpm add yellow-ts
```

### Simplified Authentication Service

```typescript
import { Client } from 'yellow-ts';
import {
  createAuthRequestMessage,
  createAuthVerifyMessage,
  createEIP712AuthMessageSigner,
  createECDSAMessageSigner,
} from '@erc7824/nitrolite';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';

const CLEARNET_SANDBOX_URL = 'wss://clearnet-sandbox.yellow.com/ws';

export class YellowClientService {
  private client: Client;
  private sessionAddress: Address | null = null;
  private isAuthenticated = false;

  constructor() {
    this.client = new Client({
      url: CLEARNET_SANDBOX_URL,
      requestTimeoutMs: 30000,
    });
  }

  async connect(): Promise<void> {
    await this.client.connect();
  }

  async authenticate(walletClient: WalletClient, userAddress: Address): Promise<void> {
    // Generate session key
    const sessionPrivateKey = generatePrivateKey();
    const sessionAccount = privateKeyToAccount(sessionPrivateKey);
    this.sessionAddress = sessionAccount.address;
    const sessionExpiry = Math.floor(Date.now() / 1000) + 3600;

    // Prepare auth params
    const authParams = {
      address: userAddress,
      session_key: this.sessionAddress,
      application: 'My App Name',
      expires_at: BigInt(sessionExpiry),
      allowances: [],
      scope: 'console',
    };

    // Send auth request
    const authRequestMsg = await createAuthRequestMessage(authParams);
    const authResponse = await this.client.sendMessage(JSON.parse(authRequestMsg));

    // Get challenge from response
    const challengeMessage = authResponse?.params?.challengeMessage;

    if (!challengeMessage) {
      throw new Error('No challenge received');
    }

    // Create EIP-712 signer with SIMPLE domain
    const domain = { name: 'My App Name' };
    const eip712Signer = await createEIP712AuthMessageSigner(
      walletClient,
      {
        wallet: userAddress,
        session_key: this.sessionAddress,
        expires_at: BigInt(sessionExpiry),
        allowances: [],
        scope: 'console',
      },
      domain
    );

    // Sign and verify
    const verifyMsg = await createAuthVerifyMessage(eip712Signer, authResponse);
    const verifyResponse = await this.client.sendMessage(JSON.parse(verifyMsg));

    if (verifyResponse?.method === 'auth_verify') {
      this.isAuthenticated = true;
      console.log('JWT Token:', verifyResponse.params.jwtToken);
    }
  }
}
```

### Successful Response

After fixes, authentication returns:

```json
{
  "method": "auth_verify",
  "params": {
    "address": "0x456a3c2854c17fDFEd59FB840988685eEe29F2D1",
    "sessionKey": "0x5f83462f23D30587568539717c27E3b93BE6870D",
    "success": true,
    "jwtToken": "eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

## Key Takeaways

1. **EIP-712 Domain**: Keep it minimal - just `{ name: 'YourAppName' }`
2. **Test Tokens**: Query `get_assets` to find supported tokens on sandbox
3. **Use `yellow-ts`**: Handles WebSocket reconnection and message correlation
4. **Response Format**: Check both `res[]` array and `params` object formats
5. **Sandbox URL**: `wss://clearnet-sandbox.yellow.com/ws` for testing

## Resources

- [Yellow Network Docs](https://docs.yellow.org)
- [Nitrolite SDK](https://github.com/erc7824/nitrolite)
- [yellow-ts](https://github.com/stevenzeiler/yellow-ts)
- [ERC-7824 Specification](https://erc7824.org)

---

*Built during ETHGlobal Hackathon 2025 - A prediction market for live streamers using Yellow Network's state channels for instant, gasless transactions.*
