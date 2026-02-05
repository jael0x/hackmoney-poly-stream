import { createServerClient } from '@/lib/supabase/server';
import { getLiveStreams, getThumbnailUrl } from '@/lib/twitch/client';
import { LiveStreamCard } from '@/components/live-stream-card';
import { StreamerCard } from '@/components/streamer-card';
import { Navbar } from '@/components/navbar';
import { TrendingUp, Flame, Tv } from 'lucide-react';
import type { Database } from '@/types/database';
import type { TwitchStream } from '@/types/twitch';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Streamer = Database['public']['Tables']['streamers']['Row'];

async function getStreamers(): Promise<Streamer[]> {
  const supabase = createServerClient();
  const { data: streamers, error } = await supabase
    .from('streamers')
    .select('*')
    .order('followers_count', { ascending: false });

  if (error) {
    console.error('Error fetching streamers:', error);
    return [];
  }

  return streamers || [];
}

async function getTopLiveStreams(): Promise<TwitchStream[]> {
  try {
    const streams = await getLiveStreams(20);
    return streams.map((stream) => ({
      ...stream,
      thumbnail_url: getThumbnailUrl(stream.thumbnail_url),
    }));
  } catch (error) {
    console.error('Error fetching live streams:', error);
    return [];
  }
}

export default async function Home() {
  const [streamers, liveStreams] = await Promise.all([
    getStreamers(),
    getTopLiveStreams(),
  ]);

  return (
    <div className="min-h-screen bg-gray-950">
      <Navbar />

      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-12">
          <div className="flex items-center gap-3 mb-4">
            <Tv className="h-8 w-8 text-purple-400" />
            <h1 className="text-3xl font-bold text-white">Live on Twitch</h1>
          </div>
          <p className="text-gray-400 text-lg">
            Top 20 live streams right now. Jump in and start predicting.
          </p>
        </div>

        {liveStreams.length === 0 ? (
          <div className="text-center py-12">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-800 mb-4">
              <TrendingUp className="h-8 w-8 text-gray-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-300 mb-2">
              No live streams found
            </h3>
            <p className="text-gray-500">
              Try again in a few minutes for updated live streams
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-12">
            {liveStreams.map((stream) => (
              <LiveStreamCard key={stream.id} stream={stream} />
            ))}
          </div>
        )}

        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <Flame className="h-8 w-8 text-orange-500" />
            <h1 className="text-3xl font-bold text-white">
              Trending Streamers
            </h1>
          </div>
          <p className="text-gray-400 text-lg">
            Predict outcomes from your favorite gaming streamers and win big
          </p>
        </div>

        {streamers.length === 0 ? (
          <div className="text-center py-16">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-800 mb-4">
              <TrendingUp className="h-8 w-8 text-gray-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-300 mb-2">
              No streamers yet
            </h3>
            <p className="text-gray-500">
              Check back soon for exciting prediction markets
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {streamers.map((streamer) => (
              <StreamerCard
                key={streamer.id}
                id={streamer.id}
                slug={streamer.slug}
                name={streamer.name}
                description={streamer.description}
                profileImageUrl={streamer.profile_image_url}
                bannerImageUrl={streamer.banner_image_url}
                isLive={streamer.is_live}
                followersCount={streamer.followers_count}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
