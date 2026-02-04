# Nitrolite Prediction Market 🎯

A fully-commented demonstration of a prediction market built on Yellow Network using the Nitrolite SDK. This project showcases state channels for high-frequency betting with minimal gas costs.

## 🏗️ Architecture Overview

### Frontend (`/frontend`)
- **React + Vite + TypeScript**: Modern frontend stack for rapid development
- **TailwindCSS**: Utility-first CSS framework for styling
- **Wagmi**: Ethereum wallet connection and blockchain interaction
- **Zustand**: Lightweight state management

### Backend Services (`/frontend/src/services`)
- **WebSocket Manager**: Handles Yellow Network real-time communication
- **Auth Service**: EIP-712 authentication with session keys
- **Channel Manager**: Payment channel lifecycle management
- **Market Service**: Prediction market logic and odds calculation

### Smart Contract Integration
- **Nitrolite Contracts**: State channel implementation on Sepolia
- **Yellow Network**: Off-chain scalability layer
- **Test Token (USDC)**: USDC-like token for testing

## 🚀 Quick Start

### Prerequisites
- Node.js v18+
- MetaMask wallet
- Sepolia testnet ETH
- Test USDC tokens

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/yellowt.git
cd yellowt
```

2. Install dependencies:
```bash
cd frontend
npm install
```

3. Configure environment:
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. Start development server:
```bash
npm run dev
```

5. Open http://localhost:5173 in your browser

## 📚 Project Structure

```
yellowt/
├── frontend/                  # React application
│   ├── src/
│   │   ├── services/         # Backend logic
│   │   │   ├── websocket.ts # WebSocket connection management
│   │   │   ├── auth.ts      # Authentication flow
│   │   │   ├── channel.ts   # Channel operations
│   │   │   └── market.ts    # Prediction market logic
│   │   ├── components/       # React components
│   │   │   ├── layout/      # Header, Footer
│   │   │   ├── wallet/      # Wallet connection
│   │   │   └── market/      # Market UI components
│   │   ├── pages/           # Application pages
│   │   │   ├── Home.tsx     # Landing page
│   │   │   ├── Market.tsx   # Betting interface
│   │   │   └── Admin.tsx    # Market management
│   │   ├── store/           # Zustand state management
│   │   ├── types/           # TypeScript definitions
│   │   └── config/          # Configuration files
│   └── package.json
└── scripts/                  # Utility scripts
    ├── create-wallet.ts     # Generate test wallet
    └── supported-networks.ts # Check network config
```

## 🔧 Key Features

### 1. **Wallet Connection**
- MetaMask integration via Wagmi
- Real-time balance updates
- Network switching support

### 2. **Yellow Network Integration**
- WebSocket connection with auto-reconnect
- EIP-712 authentication
- Session key management

### 3. **Payment Channels**
- Create channels with test USDC
- Deposit/withdraw funds
- Off-chain transaction signing

### 4. **Prediction Market**
- Binary YES/NO markets
- Dynamic odds calculation (LMSR)
- Real-time probability updates
- Admin resolution interface

### 5. **State Management**
- Global state with Zustand
- Transaction status tracking
- Error handling and recovery

## 💡 How It Works

### Authentication Flow
1. User connects MetaMask wallet
2. Generate temporary session key
3. Sign EIP-712 authentication message
4. Receive auth challenge from Yellow Network
5. Sign and verify challenge
6. Session established with time-limited permissions

### Channel Lifecycle
1. **Create**: Open payment channel with initial deposit
2. **Resize**: Add or remove funds from channel
3. **Transfer**: Place bets using channel balance
4. **Close**: Settle channel and withdraw funds

### Prediction Market Flow
1. **Admin creates market** with question and resolution date
2. **Users place predictions** on YES or NO outcomes
3. **Odds update dynamically** based on betting volume
4. **Admin resolves market** when outcome is known
5. **Winners receive payouts** based on final odds

## 🧪 Testing Workflow

1. **Get Test Tokens**:
```bash
# Request from faucet
curl -XPOST https://clearnet-sandbox.yellow.com/faucet/requestTokens \
  -H "Content-Type: application/json" \
  -d '{"userAddress":"YOUR_WALLET_ADDRESS"}'
```

2. **Connect to Yellow Network**:
- Click "Connect Wallet" in the app
- Click "Connect to Yellow Network"
- Sign authentication messages

3. **Create Prediction Market**:
- Navigate to Admin panel
- Enter market question
- Set resolution date
- Click "Create Market"

4. **Place Predictions**:
- Go to Market page
- Select YES or NO outcome
- Enter bet amount
- Click "Place Prediction"

5. **Resolve Market**:
- Return to Admin panel
- Click "Resolve YES" or "Resolve NO"
- Winners automatically calculated

## 📝 Code Comments

Every file in this project is thoroughly commented to explain:
- **Purpose**: What the code does
- **Implementation**: How it works
- **Integration**: How components connect
- **Best Practices**: Why certain patterns are used

This makes the codebase ideal for:
- Learning state channel development
- Understanding Yellow Network integration
- Building production prediction markets
- Educational demonstrations

## 🔒 Security Considerations

**⚠️ This is a test implementation:**
- Do not use real funds
- Private keys are for testing only
- No audit has been performed
- Not suitable for production

## 🤝 Contributing

This is a test project for educational purposes. Feel free to:
- Report issues
- Suggest improvements
- Fork and experiment
- Use as a learning resource

## 📄 License

MIT License - See LICENSE file for details

## 🔗 Resources

- [Nitrolite Documentation](https://docs.nitrolite.network)
- [Yellow Network](https://yellow.com)
- [Wagmi Documentation](https://wagmi.sh)
- [Viem Documentation](https://viem.sh)

## 🙋 Support

For questions or issues:
- Check the code comments first
- Review the documentation
- Open a GitHub issue
- Contact the development team

---

**Built with ❤️ for HackMoney 2026**

# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
