/**
 * Zustand Global State Store
 * Manages application-wide state for wallet, channels, markets, and UI
 */

import { create } from 'zustand';
import type {
  WalletState,
  ChannelState,
  WebSocketState,
  AuthState,
  PredictionMarket,
  UserPosition,
  TransactionState
} from '../types';

/**
 * Application store interface
 */
interface AppStore {
  // Wallet state
  wallet: WalletState;
  setWallet: (wallet: Partial<WalletState>) => void;
  resetWallet: () => void;

  // Yellow Network channel state
  channel: ChannelState;
  setChannel: (channel: Partial<ChannelState>) => void;
  resetChannel: () => void;

  // WebSocket connection state
  websocket: WebSocketState;
  setWebSocket: (state: Partial<WebSocketState>) => void;

  // Authentication state
  auth: AuthState;
  setAuth: (auth: Partial<AuthState>) => void;
  resetAuth: () => void;

  // Market state
  currentMarket: PredictionMarket | null;
  setCurrentMarket: (market: PredictionMarket | null) => void;

  allMarkets: PredictionMarket[];
  setAllMarkets: (markets: PredictionMarket[]) => void;

  userPositions: UserPosition[];
  setUserPositions: (positions: UserPosition[]) => void;
  addUserPosition: (position: UserPosition) => void;

  // Transaction state for UI feedback
  transaction: TransactionState;
  setTransaction: (state: Partial<TransactionState>) => void;
  resetTransaction: () => void;

  // UI state
  isDepositModalOpen: boolean;
  setDepositModalOpen: (open: boolean) => void;

  isWithdrawModalOpen: boolean;
  setWithdrawModalOpen: (open: boolean) => void;

  selectedOutcome: number | null;
  setSelectedOutcome: (outcome: number | null) => void;

  betAmount: string;
  setBetAmount: (amount: string) => void;

  // Utility functions
  reset: () => void;
}

/**
 * Create the global store
 */
export const useStore = create<AppStore>((set) => ({
  // Initial wallet state
  wallet: {
    isConnected: false,
    address: undefined,
    balance: undefined,
    tokenBalance: undefined,
  },
  setWallet: (wallet) =>
    set((state) => ({ wallet: { ...state.wallet, ...wallet } })),
  resetWallet: () =>
    set({
      wallet: {
        isConnected: false,
        address: undefined,
        balance: undefined,
        tokenBalance: undefined,
      },
    }),

  // Initial channel state
  channel: {
    channelId: undefined,
    isOpen: false,
    balance: 0n,
    lockedBalance: 0n,
    serverSignature: undefined,
  },
  setChannel: (channel) =>
    set((state) => ({ channel: { ...state.channel, ...channel } })),
  resetChannel: () =>
    set({
      channel: {
        channelId: undefined,
        isOpen: false,
        balance: 0n,
        lockedBalance: 0n,
        serverSignature: undefined,
      },
    }),

  // Initial WebSocket state
  websocket: {
    isConnected: false,
    connectionError: undefined,
    lastMessage: undefined,
  },
  setWebSocket: (websocket) =>
    set((state) => ({ websocket: { ...state.websocket, ...websocket } })),

  // Initial auth state
  auth: {
    sessionKey: undefined,
    sessionExpiry: undefined,
    isAuthenticated: false,
  },
  setAuth: (auth) =>
    set((state) => ({ auth: { ...state.auth, ...auth } })),
  resetAuth: () =>
    set({
      auth: {
        sessionKey: undefined,
        sessionExpiry: undefined,
        isAuthenticated: false,
      },
    }),

  // Initial market state
  currentMarket: null,
  setCurrentMarket: (market) => set({ currentMarket: market }),

  allMarkets: [],
  setAllMarkets: (markets) => set({ allMarkets: markets }),

  userPositions: [],
  setUserPositions: (positions) => set({ userPositions: positions }),
  addUserPosition: (position) =>
    set((state) => ({ userPositions: [...state.userPositions, position] })),

  // Initial transaction state
  transaction: {
    isLoading: false,
    hash: undefined,
    error: undefined,
    message: undefined,
  },
  setTransaction: (transaction) =>
    set((state) => ({ transaction: { ...state.transaction, ...transaction } })),
  resetTransaction: () =>
    set({
      transaction: {
        isLoading: false,
        hash: undefined,
        error: undefined,
        message: undefined,
      },
    }),

  // Initial UI state
  isDepositModalOpen: false,
  setDepositModalOpen: (open) => set({ isDepositModalOpen: open }),

  isWithdrawModalOpen: false,
  setWithdrawModalOpen: (open) => set({ isWithdrawModalOpen: open }),

  selectedOutcome: null,
  setSelectedOutcome: (outcome) => set({ selectedOutcome: outcome }),

  betAmount: '',
  setBetAmount: (amount) => set({ betAmount: amount }),

  // Reset everything
  reset: () =>
    set({
      wallet: {
        isConnected: false,
        address: undefined,
        balance: undefined,
        tokenBalance: undefined,
      },
      channel: {
        channelId: undefined,
        isOpen: false,
        balance: 0n,
        lockedBalance: 0n,
        serverSignature: undefined,
      },
      websocket: {
        isConnected: false,
        connectionError: undefined,
        lastMessage: undefined,
      },
      auth: {
        sessionKey: undefined,
        sessionExpiry: undefined,
        isAuthenticated: false,
      },
      currentMarket: null,
      allMarkets: [],
      userPositions: [],
      transaction: {
        isLoading: false,
        hash: undefined,
        error: undefined,
        message: undefined,
      },
      isDepositModalOpen: false,
      isWithdrawModalOpen: false,
      selectedOutcome: null,
      betAmount: '',
    }),
}));

// Export hook for accessing specific store slices
export const useWallet = () => useStore((state) => state.wallet);
export const useChannel = () => useStore((state) => state.channel);
export const useWebSocket = () => useStore((state) => state.websocket);
export const useAuth = () => useStore((state) => state.auth);
export const useMarket = () => useStore((state) => ({
  currentMarket: state.currentMarket,
  allMarkets: state.allMarkets,
  userPositions: state.userPositions,
}));
export const useTransaction = () => useStore((state) => state.transaction);
export const useUI = () => useStore((state) => ({
  isDepositModalOpen: state.isDepositModalOpen,
  isWithdrawModalOpen: state.isWithdrawModalOpen,
  selectedOutcome: state.selectedOutcome,
  betAmount: state.betAmount,
}));