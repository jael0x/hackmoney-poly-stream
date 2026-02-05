import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Eye, Gamepad2 } from 'lucide-react';
import type { TwitchStream } from '@/types/twitch';

interface LiveStreamCardProps {
  stream: TwitchStream;
}

function formatViewerCount(count: number): string {
  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(1)}M`;
  }
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}K`;
  }
  return count.toString();
}

export function LiveStreamCard({ stream }: LiveStreamCardProps) {
  return (
    <Link href={`/streamer/${stream.user_login}`}>
      <Card className="group overflow-hidden border-gray-800 bg-gray-900 hover:border-purple-500 transition-all duration-300 cursor-pointer">
        <div className="relative aspect-video overflow-hidden">
          <img
            src={stream.thumbnail_url}
            alt={stream.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
          <Badge className="absolute top-3 left-3 bg-red-600 text-white border-0">
            <span className="relative flex h-2 w-2 mr-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
            </span>
            LIVE
          </Badge>
          <div className="absolute bottom-3 left-3 flex items-center gap-1.5 bg-black/70 px-2 py-1 rounded text-sm text-white">
            <Eye className="h-3.5 w-3.5" />
            <span>{formatViewerCount(stream.viewer_count)}</span>
          </div>
        </div>

        <div className="p-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold shrink-0">
              {stream.user_name[0]}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-white font-semibold truncate group-hover:text-purple-400 transition-colors">
                {stream.user_name}
              </h3>
              <p className="text-gray-400 text-sm truncate">{stream.title}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 mt-3 text-gray-500 text-sm">
            <Gamepad2 className="h-4 w-4" />
            <span className="truncate">{stream.game_name || 'Just Chatting'}</span>
          </div>
        </div>
      </Card>
    </Link>
  );
}
