
"use client";

/**
 * WalletConnect Component
 * Handles wallet connection using wagmi
 */

import React, { useEffect } from 'react';
import { useAccount, useConnect, useDisconnect, useBalance, useSwitchChain } from 'wagmi';
import { sepolia } from 'wagmi/chains';
// import { useStore } from '../../store';
import { formatEther, Address } from 'viem';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

/**
 * WalletConnect component
 * Displays wallet connection button and connected wallet info
 */
export default function WalletConnect() {
  const { address, isConnected, chainId } = useAccount();
  const { connect, connectors, isPending, error } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();
  // const { setWallet } = useStore();

  // Get ETH balance
  const { data: ethBalance } = useBalance({
    address,
  });

  // Get token balance
  const { data: tokenBalance } = useBalance({
    address,
    token: process.env.NEXT_PUBLIC_USDC_TOKEN_ADDRESS as Address,
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

  // Auto-switch to Sepolia when connected to wrong network
  useEffect(() => {
    if (isConnected && chainId !== sepolia.id) {
      console.log('[WalletConnect] Wrong network detected, switching to Sepolia...');
      switchChain({ chainId: sepolia.id });
    }
  }, [isConnected, chainId, switchChain]);

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
  const handleConnect = async () => {
    // Use the first available connector (MetaMask)
    const connector = connectors[0];
    if (connector) {
      // Connect with Sepolia chain ID to prompt network switch
      connect({
        connector,
        chainId: sepolia.id
      });
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
        {/* <div className="text-sm text-gray-300">
          <div className="flex items-center space-x-2">
            <span>ETH:</span>
            <span className="font-mono">{formatBalance(ethBalance?.value)}</span>
          </div>
          <div className="flex items-center space-x-2">
            <span>{tokenBalance?.symbol || 'USDC'}:</span>
            <span className="font-mono">{formatBalance(tokenBalance?.value, tokenBalance?.decimals || 6)}</span>
          </div>
        </div> */}

        {/* Disconnect Button */}
        <Button
          className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white transition-colors"
          asChild
        >
          <Link href="/profile">
            {formatAddress(address)}
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div>
      {/* Connect Button */}
      <Button
        onClick={handleConnect}
        disabled={isPending}
        className="px-6 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white transition-colors"
      >
        {isPending ? 'Connecting...' : 'Connect Wallet'}
      </Button>

      {/* Error Display */}
      {error && (
        <div className="mt-2 text-red-500 text-sm">
          {error.message}
        </div>
      )}
    </div>
  );
};