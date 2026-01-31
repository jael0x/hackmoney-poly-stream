import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users } from 'lucide-react';

interface StreamerCardProps {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  profileImageUrl: string | null;
  bannerImageUrl: string | null;
  isLive: boolean;
  followersCount: number;
}

export function StreamerCard({
  slug,
  name,
  description,
  profileImageUrl,
  bannerImageUrl,
  isLive,
  followersCount,
}: StreamerCardProps) {
  return (
    <Link href={`/streamer/${slug}`}>
      <Card className="group overflow-hidden border-gray-800 bg-gray-900 hover:border-purple-500 transition-all duration-300 cursor-pointer">
        <div className="relative h-40 overflow-hidden bg-gradient-to-br from-purple-900/20 to-pink-900/20">
          {bannerImageUrl ? (
            <img
              src={bannerImageUrl}
              alt={`${name} banner`}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-purple-600 to-pink-600" />
          )}
          {isLive && (
            <Badge className="absolute top-3 right-3 bg-red-600 text-white border-0 animate-pulse">
              LIVE
            </Badge>
          )}
        </div>

        <div className="relative px-4 pb-4">
          <div className="flex items-start gap-3 -mt-8 relative z-10">
            <div className="relative">
              {profileImageUrl ? (
                <img
                  src={profileImageUrl}
                  alt={name}
                  className="w-16 h-16 rounded-full border-4 border-gray-900 bg-gray-800 object-cover"
                />
              ) : (
                <div className="w-16 h-16 rounded-full border-4 border-gray-900 bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-xl">
                  {name[0]}
                </div>
              )}
              {isLive && (
                <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-red-600 rounded-full border-2 border-gray-900" />
              )}
            </div>
            <div className="flex-1 pt-2">
              <h3 className="text-lg font-bold text-white group-hover:text-purple-400 transition-colors">
                {name}
              </h3>
            </div>
          </div>

          <p className="text-gray-400 text-sm mt-3 line-clamp-2">
            {description || 'Top gaming streamer'}
          </p>

          <div className="flex items-center gap-2 mt-4 text-gray-500 text-sm">
            <Users className="h-4 w-4" />
            <span>{(followersCount / 1000).toFixed(1)}K followers</span>
          </div>
        </div>
      </Card>
    </Link>
  );
}
