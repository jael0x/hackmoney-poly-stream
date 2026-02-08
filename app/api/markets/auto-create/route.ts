/**
 * API endpoint to automatically create prediction markets
 * based on live Twitch streams and their metrics
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/client';
import { getLiveStreams, getUserByLogin, getFollowerCount } from '@/lib/twitch/client';
import { YellowClient } from '@/lib/yellow/client';
import { YELLOW_CONFIG } from '@/lib/yellow/config';
import type { Hex } from 'viem';

interface MarketTemplate {
  metric: 'viewer_count' | 'followers_count';
  questionTemplate: (streamerName: string, target: number) => string;
  descriptionTemplate: (streamerName: string, target: number) => string;
  calculateTarget: (currentValue: number) => number;
  durationHours: number;
}

// Templates for auto-generated markets
const MARKET_TEMPLATES: MarketTemplate[] = [
  {
    metric: 'viewer_count',
    questionTemplate: (name, target) => `Will ${name} reach ${target.toLocaleString()} viewers in this stream?`,
    descriptionTemplate: (name, target) => `Auto-created market: Will ${name} achieve ${target.toLocaleString()} concurrent viewers during their current stream?`,
    calculateTarget: (current) => {
      // Target is 2x current viewers or minimum 1000
      return Math.max(Math.round(current * 2), 1000);
    },
    durationHours: 6, // 6 hours for viewer count markets
  },
  {
    metric: 'followers_count',
    questionTemplate: (name, target) => `Will ${name} reach ${target.toLocaleString()} followers today?`,
    descriptionTemplate: (name, target) => `Auto-created market: Will ${name} gain enough followers to reach ${target.toLocaleString()} total followers by end of day?`,
    calculateTarget: (current) => {
      // Target is +500 followers or 5% growth
      const growth = Math.max(500, Math.round(current * 0.05));
      return current + growth;
    },
    durationHours: 24, // 24 hours for follower count markets
  },
];

export async function POST(request: NextRequest) {
  try {
    console.log('🤖 Starting auto-market creation...');

    // Get all live streams
    const liveStreams = await getLiveStreams();

    if (!liveStreams || liveStreams.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No live streams found',
        created: 0,
      });
    }

    console.log(`Found ${liveStreams.length} live streams`);

    // Initialize Yellow client (requires oracle wallet)
    const oraclePrivateKey = process.env.YELLOW_ORACLE_PRIVATE_KEY;
    if (!oraclePrivateKey) {
      throw new Error('YELLOW_ORACLE_PRIVATE_KEY not configured');
    }

    const yellowClient = new YellowClient(oraclePrivateKey as Hex);
    await yellowClient.connect();

    const createdMarkets: string[] = [];

    // Process each live stream
    for (const stream of liveStreams) {
      try {
        // Get streamer from database
        const { data: streamer } = await supabase
          .from('streamers')
          .select('id, name, slug')
          .eq('slug', stream.user_login)
          .single();

        if (!streamer) {
          console.log(`Streamer ${stream.user_login} not in database, skipping...`);
          continue;
        }

        // Check if there's already an active market for this streamer
        const { data: existingMarkets } = await supabase
          .from('markets')
          .select('id')
          .eq('streamer_id', streamer.id)
          .eq('status', 'active')
          .gte('end_date', new Date().toISOString());

        if (existingMarkets && existingMarkets.length > 0) {
          console.log(`Streamer ${streamer.name} already has active markets, skipping...`);
          continue;
        }

        // Get current metrics
        const userData = await getUserByLogin(stream.user_login);
        if (!userData) continue;

        const followerCount = await getFollowerCount(userData.id);
        const viewerCount = stream.viewer_count;

        console.log(`Creating markets for ${streamer.name} (${viewerCount} viewers, ${followerCount} followers)`);

        // Create markets for each template
        for (const template of MARKET_TEMPLATES) {
          const currentValue = template.metric === 'viewer_count' ? viewerCount : followerCount;
          const targetValue = template.calculateTarget(currentValue);
          const question = template.questionTemplate(streamer.name, targetValue);
          const description = template.descriptionTemplate(streamer.name, targetValue);

          // Calculate end date
          const endDate = new Date();
          endDate.setHours(endDate.getHours() + template.durationHours);

          // Create Yellow Network App Session for this market
          const oracleAddress = yellowClient.getAddress();
          const appSessionId = await yellowClient.createAppSession({
            definition: {
              protocol: 'NitroRPC/0.4',
              application: YELLOW_CONFIG.APPLICATION_NAME,
              name: `Market: ${question.substring(0, 50)}`,
              participants: [
                YELLOW_CONFIG.DEFAULT_POOL_YES,
                YELLOW_CONFIG.DEFAULT_POOL_NO,
                oracleAddress
              ] as string[],
              weights: [0, 0, 100], // Oracle has full control to close
              quorum: 100,
              challenge: 3600,
              nonce: Date.now(),
            },
            allocations: [
              {
                participant: YELLOW_CONFIG.DEFAULT_POOL_YES as `0x${string}`,
                asset: 'ytest.usd',
                amount: '0',
              },
              {
                participant: YELLOW_CONFIG.DEFAULT_POOL_NO as `0x${string}`,
                asset: 'ytest.usd',
                amount: '0',
              },
              {
                participant: oracleAddress as `0x${string}`,
                asset: 'ytest.usd',
                amount: '0',
              },
            ],
          });

          // Insert market into database
          const { data: market, error } = await supabase
            .from('markets')
            .insert({
              streamer_id: streamer.id,
              question,
              description,
              end_date: endDate.toISOString(),
              status: 'active',
              yes_price: 50,
              no_price: 50,
              volume: 0,
              // Yellow Network fields
              app_session_id: appSessionId,
              pool_yes_address: YELLOW_CONFIG.DEFAULT_POOL_YES,
              pool_no_address: YELLOW_CONFIG.DEFAULT_POOL_NO,
              oracle_address: yellowClient.getAddress(),
              yes_amount: '0',
              no_amount: '0',
              twitch_metric: template.metric,
              target_value: targetValue,
            } as any)
            .select('id')
            .single();

          if (error) {
            console.error(`Failed to create market for ${streamer.name}:`, error);
            continue;
          }

          console.log(`✅ Created market: ${question}`);
          createdMarkets.push(market.id);
        }
      } catch (error) {
        console.error(`Error processing stream ${stream.user_login}:`, error);
        continue;
      }
    }

    await yellowClient.disconnect();

    return NextResponse.json({
      success: true,
      message: `Created ${createdMarkets.length} markets`,
      created: createdMarkets.length,
      marketIds: createdMarkets,
    });
  } catch (error) {
    console.error('Auto-market creation failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  // Allow GET requests to trigger auto-creation (useful for cron jobs)
  const request = new NextRequest('http://localhost/api/markets/auto-create');
  return POST(request);
}
