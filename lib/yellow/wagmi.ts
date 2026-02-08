/**
 * Wagmi Configuration
 * Sets up wallet connection and blockchain interaction
 */

import { createConfig, http } from 'wagmi';
import { sepolia } from 'wagmi/chains';
import { injected } from 'wagmi/connectors';

/**
 * Wagmi configuration
 * Supports MetaMask (injected) and WalletConnect
 */
export const wagmiConfig = createConfig({
  chains: [sepolia],
  connectors: [
    injected({
      target: 'metaMask',
    }),
  ],
  transports: {
    [sepolia.id]: http(process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL || 'https://sepolia.infura.io/v3/demo'),
  },
});