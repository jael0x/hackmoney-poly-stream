# PolyStream - Prediction Markets for Live Streamers

A decentralized prediction market platform for gaming streamers, powered by Yellow Network's state channels for instant, gasless transactions.

## 🎯 Overview

PolyStream solves the problem of high costs and latency in traditional blockchain betting platforms by leveraging Yellow Network's off-chain state channels. Users can create and bet on prediction markets related to Twitch streamers' performance metrics - all without paying gas fees.

### Key Features

- 🎮 **Twitch Integration** - Real-time streamer data and automated market creation
- ⚡ **Instant Transactions** - Off-chain state channels via Yellow Network
- 💸 **Gasless Betting** - No gas fees for placing bets
- 🤖 **Automated Oracle** - Twitch metrics-based market resolution
- 🏆 **Automatic Payouts** - Winners receive funds instantly upon resolution

## 🚀 Quick Start

### Prerequisites

- Node.js 20+
- MetaMask or compatible Web3 wallet
- Twitch Developer Account (for API access)
- Supabase Account (for database)

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/hackmoney-poly-stream.git
cd hackmoney-poly-stream

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
```

### Environment Variables

Create a `.env` file with the following:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Twitch API
NEXT_PUBLIC_TWITCH_CLIENT_ID=your_twitch_client_id
TWITCH_CLIENT_SECRET=your_twitch_client_secret

# Yellow Network (optional - uses defaults)
NEXT_PUBLIC_YELLOW_WS_URL=wss://clearnet-sandbox.yellow.com/ws
```

### Development

```bash
# Run development server (port 3001)
npm run dev

# Type checking
npm run typecheck

# Linting
npm run lint
```

### Production

```bash
# Build for production
npm run build

# Start production server
npm start
```

## 🏗️ Architecture

### Tech Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Frontend** | Next.js 16, React 18, TypeScript | Modern web application |
| **Styling** | Tailwind CSS, shadcn/ui | Beautiful, responsive UI |
| **State Management** | React Query, Wagmi | Data fetching & Web3 state |
| **Blockchain** | Yellow Network (@erc7824/nitrolite) | State channels for gasless betting |
| **Database** | Supabase (PostgreSQL) | User data & market metadata |
| **External APIs** | Twitch API | Streamer metrics & live data |

### Yellow Network Integration

PolyStream uses Yellow Network's App Sessions as prediction markets:

```
App Session = Prediction Market
├── Participants
│   ├── User Wallets (Bettors)
│   ├── YES Pool (0x...0001)
│   └── NO Pool (0x...0002)
├── Allocations (Fund Distribution)
│   └── Tracked via OPERATE intents
└── Version Management
    └── Each bet increments version
```

Key components:
- **YellowClient** (`lib/yellow/client.ts`) - WebSocket connection and authentication
- **App Sessions** - Prediction markets with fund locking
- **Session Keys** - 24-hour keys for gasless operations

## 💰 Getting Test Tokens

Request test tokens from Yellow Network sandbox:

```bash
curl -XPOST https://clearnet-sandbox.yellow.com/faucet/requestTokens \
  -H "Content-Type: application/json" \
  -d '{"userAddress":"YOUR_WALLET_ADDRESS"}'
```

This credits your account with 10 ytest.usd tokens for testing.

## 📱 Application Screens

### Main Application
- **Home** (`/`) - Browse trending streamers
- **Market Detail** (`/market/[id]`) - Place bets on predictions
- **Streamer Profile** (`/streamer/[slug]`) - View streamer's active markets
- **Create Market** (`/create-market`) - Create new prediction markets
- **Profile** (`/profile`) - Manage wallet and view betting history

### Yellow Network Integration
- **Test Page** (`/test-yellow`) - Direct Yellow Network testing interface

## 🔄 User Flow

1. **Connect Wallet** - MetaMask connection
2. **Authenticate** - EIP-712 signature for Yellow Network
3. **Browse Markets** - View active prediction markets
4. **Place Bets** - Select outcome (YES/NO) and amount
5. **Track Progress** - Monitor market in real-time
6. **Claim Winnings** - Automatic distribution on resolution

## 🤖 Oracle System

The oracle automatically:
- Monitors active markets every minute
- Fetches real-time Twitch metrics
- Resolves markets when conditions are met
- Distributes funds to winners

Run the oracle:
```bash
# One-time execution
curl -X POST http://localhost:3001/api/oracle/run

# Or set up a cron job for automation
*/1 * * * * curl -X POST http://localhost:3001/api/oracle/run
```

## 📊 Database Schema

### Core Tables

- **streamers** - Twitch streamer profiles
- **markets** - Prediction market details with Yellow Network session IDs
- **transactions** - User transaction history
- **profiles** - User profiles and settings

See `agents/yellow-implementation.md` for complete schema.

## 🧪 Testing

```bash
# Run tests (when implemented)
npm test

# Manual testing flow
1. Connect wallet
2. Request test tokens from faucet
3. Create a test market
4. Place test bets
5. Trigger oracle for resolution
6. Verify winnings distribution
```

## 📚 Documentation

- [`CLAUDE.md`](./CLAUDE.md) - AI assistant guidance for the codebase
- [`agents/yellow-demo.md`](./agents/yellow-demo.md) - Complete Yellow Network integration guide
- [`agents/yellow-implementation.md`](./agents/yellow-implementation.md) - Implementation status and technical details
- [`agents/views.md`](./agents/views.md) - All application screens documentation
- [`agents/product-overview.md`](./agents/product-overview.md) - Product vision and problem statement

## 🐛 Known Issues

1. **Wallet Connection** - Manual authentication required after wallet connect
2. **Balance Updates** - May require page refresh after betting
3. **Market Resolution** - Oracle must be triggered manually (no auto-cron yet)

See `agents/yellow-implementation.md` for complete list.

## 🚧 Roadmap

### High Priority
- [ ] Seamless wallet connection flow
- [ ] Implement `bets` table for tracking
- [ ] Real fund withdrawals

### Medium Priority
- [ ] AMM liquidity pools
- [ ] Advanced betting options
- [ ] Analytics dashboard

### Future Enhancements
- [ ] Mobile application
- [ ] Multi-chain support
- [ ] Additional streaming platforms (Kick, YouTube)
- [ ] Social features and leaderboards

## 🤝 Contributing

Contributions are welcome! Please check the issues page for current tasks.

## 📄 License

MIT License - see LICENSE file for details.

## 🙏 Acknowledgments

- **Yellow Network** - For state channel infrastructure and developer support
- **Twitch** - For streaming data APIs
- **Supabase** - For database and authentication
- **shadcn/ui** - For beautiful UI components

## 📞 Support

For questions or support:
- Check the [documentation](./agents/)
- Open an [issue](https://github.com/yourusername/hackmoney-poly-stream/issues)
- Contact the team on Discord

---

Built with ❤️ for HackMoney 2026
