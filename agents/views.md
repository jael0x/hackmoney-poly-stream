# PolyStream - Application Views & Screens

This document describes all the screens implemented in the PolyStream platform, covering both the main Next.js application and the Yellow Network integration app.

---

## Main Application (Next.js)

### 1. Home Page (`/`)
**File:** `app/page.tsx`

**Purpose:** Landing page that displays trending streamers and introduces users to the prediction market platform.

**Current Implementation:**
- Hero section with platform branding and messaging about prediction markets
- "Trending Streamers" section displaying a grid of streamer cards
- Fetches all streamers from Supabase ordered by follower count
- Each streamer card links to their individual profile page

**Components Used:**
- `StreamerCard` - Displays streamer banner, avatar, name, description, follower count, and LIVE badge

---

### 2. Login Page (`/login`)
**File:** `app/login/page.tsx`

**Purpose:** User authentication for existing accounts.

**Current Implementation:**
- Uses the `AuthForm` component in "login" mode
- Email and password authentication via Supabase Auth
- Dark theme with purple/pink gradient styling
- Redirects to home page on successful login

**Planned Enhancements:**
- Login via email code (magic link)
- Login with wallet connection
- Twitch OAuth for streamer authentication

---

### 3. Signup Page (`/signup`)
**File:** `app/signup/page.tsx`

**Purpose:** New user registration.

**Current Implementation:**
- Uses the `AuthForm` component in "signup" mode
- Email and password registration
- Automatically creates user profile in Supabase on signup
- Dark theme matching the login page

**Note:** It was suggested to simplify the flow by removing signup and using only login with magic link or wallet.

---

### 4. Profile Page (`/profile`)
**File:** `app/profile/page.tsx`

**Purpose:** User account management and wallet operations.

**Current Implementation:**
- **Requires authentication** - redirects to login if not authenticated
- User information display:
  - Avatar (editable via dialog)
  - Username
  - Email
  - Member since date
- Wallet section:
  - Current token balance display
  - **Deposit Tokens** button - opens dialog to add tokens to wallet
  - **Claim Tokens** button - allows claiming 100 free daily tokens
- Transaction history:
  - Shows last 10 transactions
  - Each transaction displays: type, amount, date, and status
  - Color-coded icons (green for deposits, red for withdrawals, blue for bets)

**Components Used:**
- `ProfileContent` - Main profile display and wallet management
- Dialog components for deposit and claim actions

---

### 5. Create Market Page (`/create-market`)
**File:** `app/create-market/page.tsx`

**Purpose:** Allows administrators/authorized users to create new prediction markets.

**Current Implementation:**
- **Requires authentication**
- Form fields:
  - **Streamer Selection** - Dropdown to select associated streamer
  - **Market Question** - The prediction question (e.g., "Will the streamer reach 10k viewers?")
  - **Description** - Detailed explanation of the market conditions
  - **Resolution Date** - Calendar picker for when the market will be resolved
- Form validation using Zod schema
- Submits market data to Supabase
- Redirects to market page on successful creation

**Components Used:**
- `CreateMarketForm` - Form with React Hook Form and Zod validation
- Calendar/DatePicker from shadcn/ui

---

### 6. Market Detail Page (`/market/[id]`)
**File:** `app/market/[id]/page.tsx`

**Purpose:** View detailed information about a specific market and place predictions.

**Current Implementation:**
- Dynamic route based on market ID
- Market information display:
  - Question title
  - Description
  - Associated streamer info
- Statistics cards:
  - **Volume** - Total amount bet on the market
  - **Participants** - Number of users who have placed bets
  - **Time Remaining** - Countdown to resolution date
  - **Status** - Active/Resolved/Pending
- Outcome cards:
  - **YES** option with probability percentage
  - **NO** option with probability percentage
  - Visual probability bars
- Betting interface:
  - Amount input field
  - Preset amount buttons (10, 25, 50, 100 tokens)
  - Potential return calculation
  - Place prediction button
- Updates user balance after placing bet
- Shows resolution banner if market is resolved

**Components Used:**
- `MarketDetail` - Main betting interface component
- `ProbabilityChart` - Visual chart component

---

### 7. Streamer Page (`/streamer/[slug]`)
**File:** `app/streamer/[slug]/page.tsx`

**Purpose:** Display streamer profile and their active prediction markets.

**Current Implementation:**
- Dynamic route based on streamer slug
- Streamer profile header:
  - Banner image
  - Avatar
  - Streamer name
  - Description/bio
  - Follower count
  - **LIVE** badge if currently streaming
- "Active Markets" section:
  - Grid of market cards for this streamer
  - Each card shows: question, YES/NO prices, volume, end date
  - Links to individual market detail pages
- Message if no active markets available

**Components Used:**
- `MarketCard` - Compact market summary cards

---

### 8. Streamer Overlay (Planned)
**Status:** Not yet implemented

**Purpose:** Real-time betting information overlay for OBS/streaming software.

**Planned Features:**
- Widget that streamers can add to their broadcast
- Shows current active prediction
- Displays live betting activity
- Real-time probability updates
- Interactive voting results

**Notes:** Joseph Bonilla Arciniega will provide detailed specifications for this screen.

---

## Yellow Network App (React)

This is a separate blockchain-enabled application for Yellow Network integration.

### 9. Yellow Home Page
**File:** `yellow-app/src/pages/Home.tsx`

**Purpose:** Landing page for blockchain/Yellow Network features.

**Current Implementation:**
- Connection status indicators:
  - Wallet connection status
  - WebSocket connection status
  - Authentication status
  - Payment channel status
- Quick action buttons:
  - **Connect to Yellow Network** - Authenticates and creates payment channel
  - **View Market** - Navigate to market page
  - **Deposit Funds** - Add USDC to payment channel
  - **Admin Panel** - Market management
- Hero section with Nitrolite branding
- Test network notice (Sepolia testnet)
- Usage instructions

---

### 10. Yellow Market Page
**File:** `yellow-app/src/pages/Market.tsx`

**Purpose:** Blockchain-enabled prediction market interface.

**Current Implementation:**
- Market header with question and description
- Statistics display:
  - Total volume (in USDC)
  - Number of participants
  - Time until resolution
  - Market status
- YES/NO outcome cards:
  - Probability percentages
  - Visual probability bars
- Betting interface:
  - Amount input (USDC)
  - Potential payout calculation
  - Channel balance display
  - Place prediction button (requires open channel)
- Resolution banner for resolved markets
- Auto-refreshes market data every 5 seconds

---

### 11. Yellow Admin Page
**File:** `yellow-app/src/pages/Admin.tsx`

**Purpose:** Administrative interface for market management.

**Current Implementation:**
- **Create New Market** section:
  - Question input field
  - Optional description textarea
  - Optional resolution date picker
  - Create button
- **Existing Markets** section:
  - List of all markets with details
  - Shows: ID, volume, participants, status
  - YES/NO probability percentages
  - **Resolve YES** / **Resolve NO** buttons for active markets
  - Status badges for resolved markets ("YES Won" / "NO Won")
- Channel management info section
- Test workflow instructions

---

## Shared Components

### Navigation (`components/navbar.tsx`)
- Sticky top navigation bar
- Logo and home link
- Search bar for finding streamers
- Authentication-aware buttons:
  - Logged out: Login / Sign Up buttons
  - Logged in: Create Market / Profile / Sign Out buttons
- Mobile responsive with hamburger menu

### UI Component Library
The project uses **shadcn/ui** components including:
- Card, Button, Input, Label, Dialog, Badge, Avatar
- Tabs, Select, Form, Calendar, Popover, Textarea
- Alert, Progress, Skeleton, Toast, Tooltip
- And more...

---

## Routing Summary

### Main App (Next.js)
| Route | Page | Auth Required |
|-------|------|---------------|
| `/` | Home | No |
| `/login` | Login | No |
| `/signup` | Signup | No |
| `/profile` | Profile | Yes |
| `/create-market` | Create Market | Yes |
| `/market/[id]` | Market Detail | No |
| `/streamer/[slug]` | Streamer Profile | No |

### Yellow App (React)
| Route | Page | Description |
|-------|------|-------------|
| `/` | Home | Blockchain connection hub |
| `/market` | Market | Prediction betting |
| `/admin` | Admin | Market management |
