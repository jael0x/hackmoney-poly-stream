/**
 * API endpoint to create a prediction market with Yellow Network integration
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { YellowClient } from '@/lib/yellow/client';
import { YELLOW_CONFIG } from '@/lib/yellow/config';
import type { Hex } from 'viem';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { streamerId, question, description, twitchMetric, targetValue, endDate } = body;

    // Validate required fields
    if (!streamerId || !question || !twitchMetric || !targetValue || !endDate) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Check authentication
    const supabase = createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log(`🎲 Creating market: ${question}`);

    // Initialize Yellow client with oracle private key
    const oraclePrivateKey = process.env.YELLOW_ORACLE_PRIVATE_KEY;
    if (!oraclePrivateKey) {
      throw new Error('YELLOW_ORACLE_PRIVATE_KEY not configured');
    }

    const yellowClient = new YellowClient(oraclePrivateKey as Hex);
    await yellowClient.connect();

    // Create Yellow Network App Session
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

    console.log(`✅ Yellow App Session created: ${appSessionId}`);

    // Insert market into database
    const { data: market, error } = await supabase
      .from('markets')
      .insert({
        streamer_id: streamerId,
        question,
        description: description || null,
        end_date: endDate,
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
        twitch_metric: twitchMetric,
        target_value: targetValue,
      } as any)
      .select()
      .single();

    await yellowClient.disconnect();

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { error: 'Failed to create market in database' },
        { status: 500 }
      );
    }

    console.log(`✅ Market created successfully: ${market.id}`);

    return NextResponse.json({
      success: true,
      market,
    });
  } catch (error) {
    console.error('Market creation failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
