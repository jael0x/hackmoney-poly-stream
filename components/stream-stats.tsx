'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Users, Star, Tv, Clock, Gamepad2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface StreamStatsProps {
  viewerCount?: number;
  followersCount: number;
  broadcasterType?: string;
  gameName?: string;
  startedAt?: string;
  isLive: boolean;
}

export function StreamStats({
  viewerCount,
  followersCount,
  broadcasterType,
  gameName,
  startedAt,
  isLive,
}: StreamStatsProps) {
  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toLocaleString();
  };

  const getBroadcasterStatus = () => {
    switch (broadcasterType) {
      case 'partner':
        return { label: 'Partner', color: 'text-purple-500', bgColor: 'bg-purple-500/10' };
      case 'affiliate':
        return { label: 'Affiliate', color: 'text-green-500', bgColor: 'bg-green-500/10' };
      default:
        return { label: 'Streamer', color: 'text-gray-500', bgColor: 'bg-gray-500/10' };
    }
  };

  const getUptime = () => {
    if (!startedAt) return 'N/A';
    try {
      return formatDistanceToNow(new Date(startedAt), { addSuffix: false });
    } catch {
      return 'N/A';
    }
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
      {/* Current Viewers - Only show when live */}
      {isLive && viewerCount !== undefined && (
        <Card className="bg-gray-900 border-gray-800 hover:border-purple-500/50 transition-colors">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-gray-400 mb-2">
              <Tv className="h-4 w-4 text-red-500" />
              <span className="text-xs font-medium uppercase">Live Viewers</span>
            </div>
            <p className="text-2xl font-bold text-white">{formatNumber(viewerCount)}</p>
            <div className="flex items-center gap-1 mt-1">
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-xs text-gray-500">Watching now</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Followers */}
      <Card className="bg-gray-900 border-gray-800 hover:border-purple-500/50 transition-colors">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-gray-400 mb-2">
            <Users className="h-4 w-4 text-purple-500" />
            <span className="text-xs font-medium uppercase">Followers</span>
          </div>
          <p className="text-2xl font-bold text-white">{formatNumber(followersCount)}</p>
          <p className="text-xs text-gray-500 mt-1">Total followers</p>
        </CardContent>
      </Card>

      {/* Broadcaster Status */}
      {broadcasterType && (
        <Card className="bg-gray-900 border-gray-800 hover:border-purple-500/50 transition-colors">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-gray-400 mb-2">
              <Star className={`h-4 w-4 ${getBroadcasterStatus().color}`} />
              <span className="text-xs font-medium uppercase">Status</span>
            </div>
            <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full ${getBroadcasterStatus().bgColor}`}>
              <p className={`text-lg font-bold ${getBroadcasterStatus().color}`}>
                {getBroadcasterStatus().label}
              </p>
            </div>
            <p className="text-xs text-gray-500 mt-1">Broadcaster type</p>
          </CardContent>
        </Card>
      )}

      {/* Game/Category */}
      {gameName && (
        <Card className="bg-gray-900 border-gray-800 hover:border-purple-500/50 transition-colors">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-gray-400 mb-2">
              <Gamepad2 className="h-4 w-4 text-green-500" />
              <span className="text-xs font-medium uppercase">Category</span>
            </div>
            <p className="text-lg font-bold text-white truncate" title={gameName}>
              {gameName}
            </p>
            <p className="text-xs text-gray-500 mt-1">Currently playing</p>
          </CardContent>
        </Card>
      )}

      {/* Stream Uptime - Only show when live */}
      {isLive && startedAt && (
        <Card className="bg-gray-900 border-gray-800 hover:border-purple-500/50 transition-colors">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-gray-400 mb-2">
              <Clock className="h-4 w-4 text-orange-500" />
              <span className="text-xs font-medium uppercase">Uptime</span>
            </div>
            <p className="text-2xl font-bold text-white">{getUptime()}</p>
            <p className="text-xs text-gray-500 mt-1">Streaming for</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
