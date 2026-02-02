'use client';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ProbabilityChart } from '@/components/probability-chart';
import { TrendingUp, Clock } from 'lucide-react';
import { useState } from 'react';
import Link from 'next/link';

interface MarketCardProps {
  id: string;
  question: string;
  description: string | null;
  yesPrice: number;
  noPrice: number;
  volume: number;
  endDate: string | null;
  onBuy?: (marketId: string, position: 'yes' | 'no') => void;
}

export function MarketCard({
  id,
  question,
  description,
  yesPrice,
  noPrice,
  volume,
  endDate,
  onBuy,
}: MarketCardProps) {
  const [selectedPosition, setSelectedPosition] = useState<'yes' | 'no' | null>(null);

  const handleBuyClick = (position: 'yes' | 'no') => {
    setSelectedPosition(position);
    onBuy?.(id, position);
  };

  const formatVolume = (vol: number) => {
    if (vol >= 1000000) return `$${(vol / 1000000).toFixed(1)}M`;
    if (vol >= 1000) return `$${(vol / 1000).toFixed(1)}K`;
    return `$${vol.toFixed(0)}`;
  };

  const formatEndDate = (date: string | null) => {
    if (!date) return null;
    const endTime = new Date(date);
    const now = new Date();
    const diffMs = endTime.getTime() - now.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) return `${diffDays}d left`;
    if (diffHours > 0) return `${diffHours}h left`;
    return 'Ending soon';
  };

  return (
    <Link href={`/market/${id}`}>
      <Card className="border-gray-800 bg-gray-900 hover:border-gray-700 transition-all overflow-hidden cursor-pointer">
        <div className="p-5">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex-1">
              <h3 className="text-white font-semibold text-base leading-tight mb-2">
                {question}
              </h3>
              {description && (
                <p className="text-gray-400 text-sm line-clamp-2">{description}</p>
              )}
            </div>
          </div>

        <div className="mb-4">
          <ProbabilityChart currentPrice={yesPrice} />
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-gray-950 rounded-lg p-3 border border-gray-800">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gray-500 font-medium">YES</span>
              <span className="text-lg font-bold text-green-400">
                {yesPrice.toFixed(0)}%
              </span>
            </div>
            <Button
              size="sm"
              className="w-full bg-green-600 hover:bg-green-700 text-white"
              onClick={() => handleBuyClick('yes')}
            >
              Buy YES
            </Button>
          </div>

          <div className="bg-gray-950 rounded-lg p-3 border border-gray-800">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gray-500 font-medium">NO</span>
              <span className="text-lg font-bold text-red-400">
                {noPrice.toFixed(0)}%
              </span>
            </div>
            <Button
              size="sm"
              className="w-full bg-red-600 hover:bg-red-700 text-white"
              onClick={() => handleBuyClick('no')}
            >
              Buy NO
            </Button>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-gray-500">
          <div className="flex items-center gap-1">
            <TrendingUp className="h-3 w-3" />
            <span>{formatVolume(volume)} vol</span>
          </div>
          {endDate && (
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              <span>{formatEndDate(endDate)}</span>
            </div>
          )}
        </div>
        </div>
      </Card>
    </Link>
  );
}
