"use client";

import { WagmiProvider } from 'wagmi';
import { wagmiConfig } from '@/lib/yellow/wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { YellowProvider } from '@/components/providers/yellow-provider';
import { useState } from 'react';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <WagmiProvider config={wagmiConfig}>
        <YellowProvider>
          {children}
        </YellowProvider>
      </WagmiProvider>
    </QueryClientProvider>
  );
}