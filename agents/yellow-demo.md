# Yellow App - Architecture Documentation

## Table of Contents
1. [Overview](#overview)
2. [C4 Model Diagrams](#c4-model-diagrams)
   - [Context Diagram](#c1-context-diagram)
   - [Container Diagram](#c2-container-diagram)
   - [Component Diagram](#c3-component-diagram)
3. [Application Flow Diagrams](#application-flow-diagrams)
   - [Complete User Flow](#complete-user-flow)
   - [Authentication Flow](#authentication-flow)
   - [Betting Flow](#betting-flow)
4. [Technology Stack](#technology-stack)

## Overview

Yellow App is a decentralized prediction market platform built on the Yellow Network using the Nitrolite SDK. It enables users to create and participate in prediction markets using state channels for scalable, low-cost transactions on the Sepolia testnet.

**The Complete flow is:**
1. Connect
2. Authenticate
3. Define App
4. Create Session
5. Update State
6. Close

### Key Features
- **Decentralized Prediction Markets**: Binary outcome markets (YES/NO)
- **State Channel Technology**: Off-chain transactions via Yellow Network
- **Web3 Integration**: MetaMask wallet connection
- **Real-time Updates**: WebSocket communication for live market data
- **Session-based Authentication**: EIP-712 signature-based auth

## C4 Model Diagrams

### C1: Context Diagram

This diagram shows how the Yellow App interacts with external actors and systems.

```mermaid
graph TB
    subgraph "External Actors"
        User[👤 User<br/>Market Participant]
        Admin[👨‍💼 Admin<br/>Market Creator]
    end

    subgraph "Yellow App System"
        YellowApp[Yellow App<br/>Prediction Market Platform]
    end

    subgraph "External Systems"
        MetaMask[MetaMask<br/>Web3 Wallet]
        YellowNetwork[Yellow Network<br/>State Channel Service]
        Blockchain[Sepolia Blockchain<br/>Ethereum Testnet]
        IPFS[IPFS<br/>Decentralized Storage]
    end

    User -->|Places bets,<br/>Views markets| YellowApp
    Admin -->|Creates markets,<br/>Resolves outcomes| YellowApp

    YellowApp -->|Wallet operations| MetaMask
    YellowApp -->|State channel ops,<br/>WebSocket msgs| YellowNetwork
    YellowApp -->|Smart contract calls| Blockchain
    YellowApp -.->|Future: Store data| IPFS

    MetaMask -->|Signs transactions| Blockchain
    YellowNetwork -->|Settlement| Blockchain

    style YellowApp fill:#f9f,stroke:#333,stroke-width:4px
    style User fill:#bbf,stroke:#333,stroke-width:2px
    style Admin fill:#bbf,stroke:#333,stroke-width:2px
```

### C2: Container Diagram

This diagram breaks down the Yellow App system into its major containers (applications/services).

```mermaid
graph TB
    subgraph "User's Browser"
        ReactApp[React SPA<br/>TypeScript/Vite<br/>Port: 5173]
    end

    subgraph "Yellow App Containers"
        subgraph "Frontend Application"
            UI[UI Layer<br/>React Components]
            StateStore[State Management<br/>Zustand Store]
            Services[Service Layer<br/>Business Logic]
        end
    end

    subgraph "External Services"
        WS[WebSocket Server<br/>Yellow Network<br/>wss://]
        RPC[RPC Node<br/>Sepolia Network]
        MetaMaskAPI[MetaMask API<br/>Browser Extension]
    end

    ReactApp --> UI
    UI --> StateStore
    UI --> Services
    StateStore <--> Services

    Services -->|WebSocket| WS
    Services -->|HTTP/JSON-RPC| RPC
    Services -->|Web3 Provider| MetaMaskAPI

    style ReactApp fill:#f9f,stroke:#333,stroke-width:4px
    style UI fill:#bbf,stroke:#333,stroke-width:2px
    style StateStore fill:#bbf,stroke:#333,stroke-width:2px
    style Services fill:#bbf,stroke:#333,stroke-width:2px
```

### C3: Component Diagram

This diagram shows the internal components of the React application.

```mermaid
graph TB
    subgraph "Pages"
        HomePage[Home Page<br/>Landing & Connection]
        MarketPage[Market Page<br/>Betting Interface]
        AdminPage[Admin Page<br/>Market Management]
    end

    subgraph "Components"
        Header[Header<br/>Navigation & Wallet]
        WalletConnect[WalletConnect<br/>Web3 Connection]
        MarketCard[MarketCard<br/>Market Display]
    end

    subgraph "Services"
        AuthService[Auth Service<br/>EIP-712 Auth]
        WebSocketService[WebSocket Service<br/>Real-time Comms]
        ChannelService[Channel Service<br/>State Channel Ops]
        MarketService[Market Service<br/>Market Logic]
    end

    subgraph "Store (Zustand)"
        WalletState[Wallet State]
        ChannelState[Channel State]
        AuthState[Auth State]
        MarketState[Market State]
        UIState[UI State]
    end

    subgraph "Configuration"
        WagmiConfig[Wagmi Config<br/>Web3 Setup]
        EnvConfig[Environment<br/>Config]
    end

    HomePage --> WalletConnect
    HomePage --> AuthService
    HomePage --> ChannelService

    MarketPage --> MarketCard
    MarketPage --> MarketService

    AdminPage --> MarketService

    Header --> WalletConnect

    AuthService --> WebSocketService
    ChannelService --> WebSocketService
    MarketService --> WebSocketService

    AuthService --> AuthState
    ChannelService --> ChannelState
    MarketService --> MarketState
    WalletConnect --> WalletState

    All_Components[All Components] -.-> UIState

    WalletConnect --> WagmiConfig
    WebSocketService --> EnvConfig

    style HomePage fill:#f9f,stroke:#333,stroke-width:2px
    style MarketPage fill:#f9f,stroke:#333,stroke-width:2px
    style AdminPage fill:#f9f,stroke:#333,stroke-width:2px
```

## Application Flow Diagrams

### Complete User Flow

This diagram shows the complete user journey from landing to placing a bet.

```mermaid
sequenceDiagram
    participant User
    participant Browser
    participant YellowApp
    participant MetaMask
    participant YellowNetwork
    participant Blockchain

    User->>Browser: Visit App
    Browser->>YellowApp: Load React App
    YellowApp->>YellowApp: Initialize Stores

    rect rgb(200, 220, 255)
        Note over User,YellowNetwork: Wallet Connection Phase
        User->>YellowApp: Click "Connect Wallet"
        YellowApp->>MetaMask: Request Connection
        MetaMask->>User: Prompt Authorization
        User->>MetaMask: Approve
        MetaMask->>YellowApp: Return Account
    end

    rect rgb(255, 220, 200)
        Note over YellowApp,YellowNetwork: WebSocket Connection Phase
        YellowApp->>YellowNetwork: Connect WebSocket
        YellowNetwork->>YellowApp: Connection Established
    end

    rect rgb(220, 255, 220)
        Note over User,YellowNetwork: Authentication Phase
        User->>YellowApp: Click "Connect to Yellow"
        YellowApp->>YellowApp: Generate Session Key
        YellowApp->>YellowNetwork: Send Auth Request
        YellowNetwork->>YellowApp: Auth Challenge
        YellowApp->>MetaMask: Sign EIP-712 Message
        User->>MetaMask: Approve Signature
        MetaMask->>YellowApp: Return Signature
        YellowApp->>YellowNetwork: Send Auth Verify
        YellowNetwork->>YellowApp: Auth Success
    end

    rect rgb(255, 255, 200)
        Note over User,Blockchain: Channel Creation Phase
        YellowApp->>MetaMask: Create Channel TX
        User->>MetaMask: Approve TX
        MetaMask->>Blockchain: Submit TX
        Blockchain->>MetaMask: TX Receipt
        MetaMask->>YellowApp: Channel Created
        YellowApp->>YellowNetwork: Register Channel
    end

    rect rgb(255, 220, 255)
        Note over User,YellowNetwork: Betting Phase
        User->>YellowApp: Navigate to Market
        YellowApp->>YellowApp: Load Market Data
        User->>YellowApp: Select Outcome & Amount
        User->>YellowApp: Place Bet
        YellowApp->>YellowNetwork: Submit Bet (Off-chain)
        YellowNetwork->>YellowApp: Bet Confirmed
        YellowApp->>User: Show Success
    end
```

### Authentication Flow

Detailed authentication flow using EIP-712 signatures.

```mermaid
flowchart TB
    Start([User Clicks Connect])
    GenKey[Generate Session Private Key]
    CreateAccount[Create Session Account]
    PrepareAuth[Prepare Auth Parameters:<br/>- Session Key<br/>- Allowances<br/>- Expiry<br/>- Scope]

    SendAuthReq[Send Auth Request<br/>to Yellow Network]
    WaitChallenge{Wait for<br/>Challenge}

    RecvChallenge[Receive Challenge Message]
    CreateSigner[Create EIP-712 Signer<br/>with Wallet Client]
    SignChallenge[Sign Challenge<br/>with Main Wallet]

    UserApprove{User Approves<br/>in MetaMask?}
    SendVerify[Send Auth Verify<br/>with Signature]

    WaitSuccess{Wait for<br/>Success}
    AuthSuccess[Authentication Complete<br/>Store Session]
    AuthFailed[Authentication Failed]

    Start --> GenKey
    GenKey --> CreateAccount
    CreateAccount --> PrepareAuth
    PrepareAuth --> SendAuthReq
    SendAuthReq --> WaitChallenge

    WaitChallenge -->|Received| RecvChallenge
    WaitChallenge -->|Timeout| AuthFailed

    RecvChallenge --> CreateSigner
    CreateSigner --> SignChallenge
    SignChallenge --> UserApprove

    UserApprove -->|Yes| SendVerify
    UserApprove -->|No| AuthFailed

    SendVerify --> WaitSuccess
    WaitSuccess -->|Success| AuthSuccess
    WaitSuccess -->|Error| AuthFailed

    style AuthSuccess fill:#9f9,stroke:#333,stroke-width:2px
    style AuthFailed fill:#f99,stroke:#333,stroke-width:2px
```

### Betting Flow

The process of placing a bet on a prediction market.

```mermaid
flowchart TB
    Start([User on Market Page])
    LoadMarkets[Load Active Markets]
    DisplayMarket[Display Market:<br/>- Question<br/>- Outcomes<br/>- Probabilities<br/>- Volume]

    SelectOutcome{User Selects<br/>Outcome?}
    SelectYes[Select YES]
    SelectNo[Select NO]

    EnterAmount[Enter Bet Amount]
    ValidateAmount{Valid<br/>Amount?}

    CheckBalance{Sufficient<br/>Channel<br/>Balance?}

    CalcPayout[Calculate<br/>Potential Payout]
    ConfirmBet[User Confirms Bet]

    SubmitBet[Submit to Market Service]
    UpdateLocal[Update Local State:<br/>- Add to positions<br/>- Update probabilities]

    SendWS[Send via WebSocket<br/>to Yellow Network]

    WaitConfirm{Wait for<br/>Confirmation}

    BetSuccess[Bet Placed Successfully<br/>Update UI]
    BetFailed[Bet Failed<br/>Show Error]

    RefreshMarket[Refresh Market Data]

    Start --> LoadMarkets
    LoadMarkets --> DisplayMarket
    DisplayMarket --> SelectOutcome

    SelectOutcome -->|YES| SelectYes
    SelectOutcome -->|NO| SelectNo
    SelectOutcome -->|None| DisplayMarket

    SelectYes --> EnterAmount
    SelectNo --> EnterAmount

    EnterAmount --> ValidateAmount
    ValidateAmount -->|Invalid| EnterAmount
    ValidateAmount -->|Valid| CheckBalance

    CheckBalance -->|Insufficient| BetFailed
    CheckBalance -->|Sufficient| CalcPayout

    CalcPayout --> ConfirmBet
    ConfirmBet --> SubmitBet

    SubmitBet --> UpdateLocal
    UpdateLocal --> SendWS

    SendWS --> WaitConfirm
    WaitConfirm -->|Success| BetSuccess
    WaitConfirm -->|Error| BetFailed

    BetSuccess --> RefreshMarket
    RefreshMarket --> DisplayMarket

    style BetSuccess fill:#9f9,stroke:#333,stroke-width:2px
    style BetFailed fill:#f99,stroke:#333,stroke-width:2px
```

## Technology Stack

### Frontend
- **Framework**: React 19.2 with TypeScript
- **Build Tool**: Vite 7.2
- **Styling**: Tailwind CSS 3.4
- **State Management**: Zustand 5.0
- **Routing**: React Router DOM 7.13

### Web3 Integration
- **Wallet Connection**: Wagmi 2.5
- **Blockchain Interaction**: Viem 2.45
- **Network**: Sepolia Testnet
- **State Channels**: @erc7824/nitrolite 0.5.3

### Communication
- **Real-time**: Native WebSocket API
- **Protocol**: Yellow Network Custom Protocol
- **Authentication**: EIP-712 Signatures

### Development
- **Language**: TypeScript 5.9
- **Linting**: ESLint 9.39
- **Package Manager**: npm
- **Node Version**: 24.10+

## Architecture Patterns

### Design Patterns Used
1. **Service Layer Pattern**: Business logic separated into service modules
2. **Store Pattern**: Centralized state management with Zustand
3. **Singleton Pattern**: Single instances for WebSocket, Auth, and Channel managers
4. **Event-Driven Architecture**: WebSocket events drive state updates
5. **Component Composition**: Reusable UI components

### Key Architectural Decisions
1. **Client-Side Only**: No backend server, direct connection to Yellow Network
2. **State Channels**: Off-chain transactions for scalability
3. **Session Keys**: Temporary keys for transaction signing
4. **Optimistic Updates**: Update UI before confirmation for better UX
5. **WebSocket Reconnection**: Automatic reconnection with exponential backoff

### Security Considerations
1. **Session Key Generation**: Client-side generation of temporary keys
2. **EIP-712 Signatures**: Typed structured data signing
3. **Allowance Limits**: Predefined spending limits for sessions
4. **Expiry Times**: 1-hour session expiry for security
5. **Environment Variables**: Sensitive config in .env files

## Data Flow

### State Management Flow
```
User Action → Component → Service → WebSocket → Yellow Network
                ↓                        ↓
            Store Update ← ← ← ← ← Response
                ↓
            UI Re-render
```

### Market Data Flow
```
Market Service → Local State (Optimistic)
        ↓
    WebSocket → Yellow Network
        ↓
    Confirmation → Update State → Refresh UI
```

### Channel Balance Flow
```
Deposit → Blockchain TX → Channel Contract
                              ↓
                    Yellow Network Update
                              ↓
                    WebSocket Notification
                              ↓
                        Update Store
```

## Deployment Architecture

### Current Setup (Development)
- **Frontend**: Vite Dev Server (localhost:5173)
- **Network**: Sepolia Testnet
- **WebSocket**: Yellow Network Test Environment

### Production Considerations
- **Frontend Hosting**: Static site (Vercel/Netlify/IPFS)
- **Network**: Mainnet or L2 (Polygon, Arbitrum)
- **WebSocket**: Production Yellow Network
- **CDN**: CloudFlare for static assets
- **Monitoring**: Error tracking and analytics

## Future Enhancements

### Planned Features
1. **Multi-Market Support**: Multiple simultaneous markets
2. **Market Categories**: Sports, Politics, Crypto, etc.
3. **Liquidity Pools**: AMM-style market making
4. **Mobile App**: React Native version
5. **Analytics Dashboard**: Market statistics and trends

### Technical Improvements
1. **Server-Side Rendering**: Next.js for SEO
2. **GraphQL API**: For complex queries
3. **IPFS Integration**: Decentralized data storage
4. **Push Notifications**: Market updates
5. **Multi-Chain Support**: Cross-chain markets