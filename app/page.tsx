import { createServerClient, createServiceClient } from '@/lib/supabase/server';
import { getLiveStreams, getThumbnailUrl } from '@/lib/twitch/client';
import { LiveStreamsSection } from '@/components/live-streams-section';
import { StreamerCard } from '@/components/streamer-card';
import { Navbar } from '@/components/navbar';
import { TrendingUp, Flame } from 'lucide-react';
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

async function getOfflineStreamers(limit: number = 20): Promise<Streamer[]> {
  const supabase = createServerClient();
  const { data: streamers, error } = await supabase
    .from('streamers')
    .select('*')
    .eq('platform', 'twitch')
    .eq('is_live', false)
    .order('followers_count', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching offline streamers:', error);
    return [];
  }

  return streamers || [];
}

async function syncLiveStreamersAndMarkets(
  streams: TwitchStream[]
): Promise<void> {
  const supabase = createServiceClient();
  const liveSlugs = streams.map((stream) => stream.user_login);

  const upsertPayload = streams.map((stream) => ({
    name: stream.user_name,
    slug: stream.user_login,
    description: stream.title,
    platform: 'twitch',
    is_live: true,
  }));

  if (streams.length > 0) {
    const { error: upsertError } = await supabase
      .from('streamers')
      .upsert(upsertPayload, { onConflict: 'slug' });

    if (upsertError) {
      console.error('Error upserting live streamers:', upsertError);
    }

    const { data: liveStreamers, error: liveStreamersError } = await supabase
      .from('streamers')
      .select('id, slug, name')
      .in('slug', liveSlugs);

    if (liveStreamersError || !liveStreamers) {
      console.error('Error fetching live streamers:', liveStreamersError);
      return;
    }

    const liveStreamerIds = liveStreamers.map((streamer) => streamer.id);
    const activeMarkets = await supabase
      .from('markets')
      .select('streamer_id')
      .in('streamer_id', liveStreamerIds)
      .eq('status', 'active');

    if (activeMarkets.error) {
      console.error('Error fetching active markets:', activeMarkets.error);
    }

    const activeMarketIds = new Set(
      activeMarkets.data?.map((market) => market.streamer_id) || []
    );

    const liveBySlug = new Map(
      liveStreamers.map((streamer) => [streamer.slug, streamer])
    );
    const topFive = liveSlugs
      .slice(0, 5)
      .map((slug) => liveBySlug.get(slug))
      .filter((streamer): streamer is { id: string; slug: string; name: string } =>
        Boolean(streamer)
      );

    const endDate = new Date(
      Date.now() + 7 * 24 * 60 * 60 * 1000
    ).toISOString();

    const marketsToInsert = topFive
      .filter((streamer) => !activeMarketIds.has(streamer.id))
      .map((streamer) => ({
        streamer_id: streamer.id,
        question: `Will ${streamer.name} reach 10k viewers today?`,
        description: `Auto-created market for ${streamer.name}'s stream.`,
        yes_price: 50,
        no_price: 50,
        volume: 0,
        end_date: endDate,
        status: 'active',
      }));

    if (marketsToInsert.length > 0) {
      const { error: insertError } = await supabase
        .from('markets')
        .insert(marketsToInsert);

      if (insertError) {
        console.error('Error creating markets:', insertError);
      }
    }
  }

  if (liveSlugs.length === 0) {
    const { error: resetAllError } = await supabase
      .from('streamers')
      .update({ is_live: false })
      .eq('platform', 'twitch')
      .eq('is_live', true);

    if (resetAllError) {
      console.error('Error resetting all streamers offline:', resetAllError);
    }
    return;
  }

  const slugList = liveSlugs.map((slug) => `"${slug}"`).join(',');
  const { error: resetError } = await supabase
    .from('streamers')
    .update({ is_live: false })
    .eq('platform', 'twitch')
    .eq('is_live', true)
    .not('slug', 'in', `(${slugList})`);

  if (resetError) {
    console.error('Error resetting offline streamers:', resetError);
  }
}

async function getTopLiveStreams(): Promise<TwitchStream[]> {
  try {
    const streams = await getLiveStreams(20);
    await syncLiveStreamersAndMarkets(streams);
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
  const liveStreams = await getTopLiveStreams();
  const [streamers, offlineStreamers] = await Promise.all([
    getStreamers(),
    getOfflineStreamers(),
  ]);

  return (
    <div className="min-h-screen bg-gray-950">
      <Navbar />

      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        <LiveStreamsSection
          liveStreams={liveStreams}
          offlineStreamers={offlineStreamers}
        />

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
