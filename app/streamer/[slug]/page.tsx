import { notFound } from 'next/navigation';
import { createServerClient, createServiceClient } from '@/lib/supabase/server';
import { Navbar } from '@/components/navbar';
import { MarketCard } from '@/components/market-card';
import { Badge } from '@/components/ui/badge';
import { TwitchEmbed } from '@/components/twitch-embed';
import { StreamStats } from '@/components/stream-stats';
import { Users, Tv } from 'lucide-react';
import type { Database } from '@/types/database';
import type { TwitchStream, TwitchUser } from '@/types/twitch';
import {
  getFollowerCount,
  getStreamByUser,
  getUserByLogin,
} from '@/lib/twitch/client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Streamer = Database['public']['Tables']['streamers']['Row'];
type Market = Database['public']['Tables']['markets']['Row'];

async function getStreamer(slug: string): Promise<Streamer | null> {
  const supabase = createServerClient();
  const { data: streamer, error } = await supabase
    .from('streamers')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();

  if (error || !streamer) {
    return null;
  }

  return streamer;
}

async function ensureStreamerAndMarket(slug: string): Promise<Streamer | null> {
  let twitchUser = null;
  try {
    twitchUser = await getUserByLogin(slug);
  } catch (error) {
    console.error('Error fetching Twitch user:', error);
  }

  const [stream, followerCount] = twitchUser
    ? await Promise.all([
        getStreamByUser(slug),
        getFollowerCount(twitchUser.id),
      ])
    : [null, 0];

  const supabase = createServiceClient();

  // Ensure we always have a name (required field)
  const displayName = twitchUser?.display_name || slug;

  // If we couldn't get Twitch user data, return null to avoid DB error
  if (!twitchUser) {
    console.error(`Twitch user not found for slug: ${slug}`);
    return null;
  }

  const upsertPayload = {
    name: displayName,
    slug,
    description: twitchUser.description || null,
    profile_image_url: twitchUser.profile_image_url || null,
    banner_image_url: twitchUser.offline_image_url || null,
    platform: 'twitch' as const,
    is_live: Boolean(stream),
    followers_count: followerCount,
  };

  const { data: upsertedStreamer, error: upsertError } = await supabase
    .from('streamers')
    .upsert(upsertPayload, { onConflict: 'slug' })
    .select('*')
    .single();

  if (upsertError || !upsertedStreamer) {
    console.error('Error upserting streamer:', upsertError);
    return null;
  }

  const { data: activeMarkets, error: activeMarketsError } = await supabase
    .from('markets')
    .select('id')
    .eq('streamer_id', upsertedStreamer.id)
    .eq('status', 'active')
    .limit(1);

  if (activeMarketsError) {
    console.error('Error checking active markets:', activeMarketsError);
  }

  if (!activeMarkets || activeMarkets.length === 0) {
    const endDate = new Date(
      Date.now() + 7 * 24 * 60 * 60 * 1000
    ).toISOString();

    const { error: insertError } = await supabase.from('markets').insert({
      streamer_id: upsertedStreamer.id,
      question: `Will ${upsertedStreamer.name} reach 10k viewers today?`,
      description: `Auto-created market for ${upsertedStreamer.name}'s stream.`,
      yes_price: 50,
      no_price: 50,
      volume: 0,
      end_date: endDate,
      status: 'active',
    });

    if (insertError) {
      console.error('Error creating market:', insertError);
    }
  }

  return upsertedStreamer;
}

async function getMarkets(streamerId: string): Promise<Market[]> {
  const supabase = createServerClient();
  const { data: markets, error } = await supabase
    .from('markets')
    .select('*')
    .eq('streamer_id', streamerId)
    .eq('status', 'active')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching markets:', error);
    return [];
  }

  return markets || [];
}

export default async function StreamerPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  // Await params in Next.js 16+
  const { slug } = await params;

  let streamer = await getStreamer(slug);

  if (!streamer) {
    streamer = await ensureStreamerAndMarket(slug);
  }

  if (!streamer) {
    notFound();
  }

  // ALWAYS get fresh data from Twitch API for accurate stats
  let streamData: TwitchStream | null = null;
  let userData: TwitchUser | null = null;
  let followerCount = streamer.followers_count; // Default to DB value

  try {
    [streamData, userData] = await Promise.all([
      getStreamByUser(slug),
      getUserByLogin(slug),
    ]);

    console.log('[StreamerPage] userData:', userData);
    console.log('[StreamerPage] streamData:', streamData);

    // Get fresh follower count
    if (userData) {
      followerCount = await getFollowerCount(userData.id);
      console.log('[StreamerPage] followerCount:', followerCount);
    }
  } catch (error) {
    console.error('Error fetching Twitch data:', error);
  }

  const markets = await getMarkets(streamer.id);

  return (
    <div className="min-h-screen bg-gray-950">
      <Navbar />

      <div
        className="relative h-64 bg-gradient-to-br from-purple-900/30 to-pink-900/30 overflow-hidden"
        style={{
          backgroundImage: streamer.banner_image_url
            ? `url(${streamer.banner_image_url})`
            : undefined,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-gray-950" />
      </div>

      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="relative -mt-16 mb-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-end gap-6">
            <div className="relative">
              {streamer.profile_image_url ? (
                <img
                  src={streamer.profile_image_url}
                  alt={streamer.name}
                  className="w-32 h-32 rounded-full border-4 border-gray-950 bg-gray-900 object-cover"
                />
              ) : (
                <div className="w-32 h-32 rounded-full border-4 border-gray-950 bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-4xl">
                  {streamer.name[0]}
                </div>
              )}
              {streamer.is_live && (
                <Badge className="absolute bottom-2 right-2 bg-red-600 text-white border-0 animate-pulse">
                  LIVE
                </Badge>
              )}
            </div>

            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl font-bold text-white">{streamer.name}</h1>
                {streamer.is_live && (
                  <div className="flex items-center gap-2 px-3 py-1 bg-red-600/20 border border-red-600 rounded-full">
                    <Tv className="h-4 w-4 text-red-500" />
                    <span className="text-sm font-medium text-red-400">Streaming</span>
                  </div>
                )}
              </div>

              <p className="text-gray-400 text-lg mb-3">
                {streamer.description || 'Top gaming streamer'}
              </p>

              <div className="flex items-center gap-4 text-gray-500">
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  <span className="font-medium">
                    {(streamer.followers_count / 1000).toFixed(1)}K followers
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Stream Statistics */}
        <StreamStats
          viewerCount={streamData?.viewer_count}
          followersCount={followerCount}
          broadcasterType={userData?.broadcaster_type}
          gameName={streamData?.game_name}
          startedAt={streamData?.started_at}
          isLive={streamer.is_live}
        />

        {/* Twitch Stream Embed - Show only when streamer is live */}
        {streamer.is_live && (
          <div className="mb-8">
            <div className="mb-4 flex items-center gap-3">
              <h2 className="text-2xl font-bold text-white">Live Stream</h2>
              <Badge className="bg-red-600 text-white border-0 animate-pulse">
                <span className="relative flex h-2 w-2 mr-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                </span>
                LIVE
              </Badge>
            </div>
            <TwitchEmbed
              channel={slug}
              height={500}
              autoplay={true}
              muted={false}
            />
          </div>
        )}

        <div className="mb-6">
          <h2 className="text-2xl font-bold text-white mb-4">Active Markets</h2>
          <p className="text-gray-400">
            Place your predictions on upcoming events
          </p>
        </div>

        {markets.length === 0 ? (
          <div className="text-center py-16">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-800 mb-4">
              <Tv className="h-8 w-8 text-gray-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-300 mb-2">
              No active markets
            </h3>
            <p className="text-gray-500">
              Check back later for new prediction opportunities
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-12">
            {markets.map((market) => (
              <MarketCard
                key={market.id}
                id={market.id}
                question={market.question}
                description={market.description}
                yesPrice={Number(market.yes_price)}
                noPrice={Number(market.no_price)}
                volume={Number(market.volume)}
                endDate={market.end_date}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
