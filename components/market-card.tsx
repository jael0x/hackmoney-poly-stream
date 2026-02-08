'use client';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BetButton } from '@/components/bet-button';
import { ClaimWinningsButton } from '@/components/claim-winnings-button';
import { ProbabilityChart } from '@/components/probability-chart';
import { TrendingUp, Clock, Zap, Target } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
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
  status?: string;
  appSessionId?: string | null;
  twitchMetric?: string | null;
  targetValue?: number | null;
  winner?: 'yes' | 'no' | null;
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
  status,
  appSessionId,
  twitchMetric,
  targetValue,
  winner,
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
              {appSessionId && (
                <div className="mt-2 flex flex-wrap gap-2">
                  <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20 hover:bg-yellow-500/10">
                    <Zap className="w-3 h-3 mr-1" />
                    Yellow Network
                  </Badge>
                  {twitchMetric && targetValue && (
                    <Badge className="bg-purple-500/10 text-purple-400 border-purple-500/20 hover:bg-purple-500/10">
                      <Target className="w-3 h-3 mr-1" />
                      {twitchMetric === 'viewer_count' ? 'Viewers' : 'Followers'}: {targetValue.toLocaleString()}
                    </Badge>
                  )}
                </div>
              )}
            </div>
          </div>

        {status === 'resolved' && winner ? (
          <div className="mb-4 p-4 bg-gray-950 rounded-lg border border-gray-800">
            <div className="text-center mb-3">
              <span className={`text-lg font-bold ${winner === 'yes' ? 'text-green-400' : 'text-red-400'}`}>
                Market Resolved: {winner.toUpperCase()} wins!
              </span>
            </div>
            <ClaimWinningsButton marketId={id} winner={winner} className="w-full" />
          </div>
        ) : (
          <>
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
            <BetButton
              marketId={id}
              position="yes"
              currentPrice={yesPrice}
              className="w-full bg-green-600 hover:bg-green-700 text-white text-sm h-9"
            >
              Buy YES
            </BetButton>
          </div>

          <div className="bg-gray-950 rounded-lg p-3 border border-gray-800">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gray-500 font-medium">NO</span>
              <span className="text-lg font-bold text-red-400">
                {noPrice.toFixed(0)}%
              </span>
            </div>
            <BetButton
              marketId={id}
              position="no"
              currentPrice={noPrice}
              className="w-full bg-red-600 hover:bg-red-700 text-white text-sm h-9"
            >
              Buy NO
            </BetButton>
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
          </>
        )}
        </div>
      </Card>
    </Link>
  );
}
