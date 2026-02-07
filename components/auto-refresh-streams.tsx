'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw } from 'lucide-react';

interface AutoRefreshStreamsProps {
  refreshInterval?: number; // in milliseconds, default 60000 (1 minute)
}

export function AutoRefreshStreams({
  refreshInterval = 60000,
}: AutoRefreshStreamsProps) {
  const router = useRouter();
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [timeUntilRefresh, setTimeUntilRefresh] = useState(refreshInterval / 1000);

  useEffect(() => {
    // Auto refresh
    const interval = setInterval(() => {
      setIsRefreshing(true);
      router.refresh();
      setLastRefresh(new Date());
      setTimeUntilRefresh(refreshInterval / 1000);
      setTimeout(() => setIsRefreshing(false), 1000);
    }, refreshInterval);

    // Countdown timer
    const countdown = setInterval(() => {
      setTimeUntilRefresh((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => {
      clearInterval(interval);
      clearInterval(countdown);
    };
  }, [router, refreshInterval]);

  const handleManualRefresh = () => {
    setIsRefreshing(true);
    router.refresh();
    setLastRefresh(new Date());
    setTimeUntilRefresh(refreshInterval / 1000);
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  return (
    <div className="flex items-center gap-3 text-sm text-gray-400">
      <button
        onClick={handleManualRefresh}
        disabled={isRefreshing}
        className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        title="Refresh live streams"
      >
        <RefreshCw
          className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`}
        />
        <span className="hidden sm:inline">Refresh</span>
      </button>

      <div className="hidden md:flex items-center gap-2">
        <div className="flex items-center gap-1.5">
          <div className={`w-2 h-2 rounded-full ${isRefreshing ? 'bg-green-500 animate-pulse' : 'bg-gray-600'}`} />
          <span>
            {isRefreshing
              ? 'Updating...'
              : `Next update in ${timeUntilRefresh}s`}
          </span>
        </div>
      </div>
    </div>
  );
}
