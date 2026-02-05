
"use client";

/**
 * WalletConnect Component
 * Handles wallet connection using wagmi
 */

import React, { useEffect } from 'react';
import { useAccount, useConnect, useDisconnect, useBalance } from 'wagmi';
// import { useStore } from '../../store';
import { formatEther, Address } from 'viem';

/**
 * WalletConnect component
 * Displays wallet connection button and connected wallet info
 */
export default function WalletConnect() {
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending, error } = useConnect();
  const { disconnect } = useDisconnect();
  // const { setWallet } = useStore();

  // Get ETH balance
  const { data: ethBalance } = useBalance({
    address,
  });

  // Get token balance
  const { data: tokenBalance } = useBalance({
    address,
    // token: process.env.NEXT_PUBLIC_USDC_TOKEN_ADDRESS as Address,
  });

  // Debug log token balance
  useEffect(() => {
    if (tokenBalance) {
      console.log('Token Balance Data:', {
        value: tokenBalance.value?.toString(),
        decimals: tokenBalance.decimals,
        symbol: tokenBalance.symbol,
        // formatted: tokenBalance.formatted
      });
    }
  }, [tokenBalance]);

  // // Update store when wallet state changes
  // useEffect(() => {
  //   setWallet({
  //     isConnected,
  //     address,
  //     balance: ethBalance?.value,
  //     tokenBalance: tokenBalance?.value,
  //   });
  // }, [isConnected, address, ethBalance, tokenBalance, setWallet]);

  /**
   * Handle wallet connection
   */
  const handleConnect = () => {
    // Use the first available connector (MetaMask)
    const connector = connectors[0];
    if (connector) {
      connect({ connector });
    }
  };

  /**
   * Handle wallet disconnection
   */
  const handleDisconnect = () => {
    disconnect();
    // setWallet({
    //   isConnected: false,
    //   address: undefined,
    //   balance: undefined,
    //   tokenBalance: undefined,
    // });
  };

  /**
   * Format address for display
   */
  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  /**
   * Format balance for display
   */
  const formatBalance = (value?: bigint, decimals = 18) => {
    if (!value) return '0';
    if (decimals === 18) {
      return parseFloat(formatEther(value)).toFixed(4);
    } else {
      // For tokens with different decimals (e.g., USDC with 6 decimals)
      return (Number(value) / Math.pow(10, decimals)).toFixed(2);
    }
  };

  if (isConnected && address) {
    return (
      <div className="flex items-center space-x-4">
        {/* Balance Display */}
        <div className="text-sm text-gray-300">
          <div className="flex items-center space-x-2">
            <span>ETH:</span>
            <span className="font-mono">{formatBalance(ethBalance?.value)}</span>
          </div>
          <div className="flex items-center space-x-2">
            <span>{tokenBalance?.symbol || 'USDC'}:</span>
            <span className="font-mono">{formatBalance(tokenBalance?.value, tokenBalance?.decimals || 6)}</span>
          </div>
        </div>

        {/* Address Display */}
        <div className="bg-gray-700 px-3 py-2 rounded-lg">
          <span className="text-green-400 text-sm font-mono">
            {formatAddress(address)}
          </span>
        </div>

        {/* Disconnect Button */}
        <button
          onClick={handleDisconnect}
          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Connect Button */}
      <button
        onClick={handleConnect}
        disabled={isPending}
        className="px-6 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white rounded-lg transition-colors"
      >
        {isPending ? 'Connecting...' : 'Connect Wallet'}
      </button>

      {/* Error Display */}
      {error && (
        <div className="mt-2 text-red-500 text-sm">
          {error.message}
        </div>
      )}
    </div>
  );
};