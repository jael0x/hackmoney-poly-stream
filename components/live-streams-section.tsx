'use client';

import { useMemo, useState } from 'react';
import type { TwitchStream } from '@/types/twitch';
import type { Database } from '@/types/database';
import { LiveStreamCard } from '@/components/live-stream-card';
import { StreamerCard } from '@/components/streamer-card';
import { AutoRefreshStreams } from '@/components/auto-refresh-streams';
import { Button } from '@/components/ui/button';

type Streamer = Database['public']['Tables']['streamers']['Row'];

interface LiveStreamsSectionProps {
  liveStreams: TwitchStream[];
  offlineStreamers: Streamer[];
}

export function LiveStreamsSection({
  liveStreams,
  offlineStreamers,
}: LiveStreamsSectionProps) {
  const [showOffline, setShowOffline] = useState(false);

  const hasLiveStreams = liveStreams.length > 0;
  const hasOfflineStreamers = offlineStreamers.length > 0;

  const offlineCards = useMemo(
    () =>
      offlineStreamers.map((streamer) => (
        <StreamerCard
          key={streamer.id}
          id={streamer.id}
          slug={streamer.slug}
          name={streamer.name}
          description={streamer.description}
          profileImageUrl={streamer.profile_image_url}
          bannerImageUrl={streamer.banner_image_url}
          isLive={false}
          followersCount={streamer.followers_count}
        />
      )),
    [offlineStreamers]
  );

  return (
    <section className="mb-12">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-white">Live on Twitch</h1>
          <p className="text-gray-400 text-lg">
            Top 20 live streams right now. Jump in and start predicting.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <AutoRefreshStreams refreshInterval={60000} />
          <Button
            type="button"
            variant="outline"
            className="border-gray-800 text-gray-300 hover:bg-gray-800 hover:text-white"
            onClick={() => setShowOffline((value) => !value)}
          >
            {showOffline ? 'Hide Offline' : 'Show Offline'}
          </Button>
        </div>
      </div>

      {!hasLiveStreams ? (
        <div className="text-center py-12">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-800 mb-4">
            <span className="text-gray-600 text-xl font-bold">?</span>
          </div>
          <h3 className="text-xl font-semibold text-gray-300 mb-2">
            No live streams found
          </h3>
          <p className="text-gray-500">
            Try again in a few minutes for updated live streams
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {liveStreams.map((stream) => (
            <LiveStreamCard key={stream.id} stream={stream} />
          ))}
        </div>
      )}

      {showOffline && (
        <div className="mt-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-white">Offline Streamers</h2>
            <span className="text-sm text-gray-500">
              {hasOfflineStreamers ? offlineStreamers.length : 0} available
            </span>
          </div>
          {hasOfflineStreamers ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {offlineCards}
            </div>
          ) : (
            <p className="text-gray-500">No offline streamers yet.</p>
          )}
        </div>
      )}
    </section>
  );
}
