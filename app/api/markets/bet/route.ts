/**
 * API endpoint to place a bet on a prediction market using Yellow Network
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/client';
import { YellowClient } from '@/lib/yellow/client';
import type { Hex } from 'viem';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { marketId, position, amount, userAddress } = body;

    // Validate required fields
    if (!marketId || !position || !amount || !userAddress) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (!['yes', 'no'].includes(position)) {
      return NextResponse.json(
        { error: 'Invalid position. Must be "yes" or "no"' },
        { status: 400 }
      );
    }

    console.log(`💰 Processing bet: ${amount} on ${position.toUpperCase()} for market ${marketId}`);

    // Fetch market from database
    const { data: market, error: marketError } = await supabase
      .from('markets')
      .select('*')
      .eq('id', marketId)
      .single();

    if (marketError || !market) {
      return NextResponse.json(
        { error: 'Market not found' },
        { status: 404 }
      );
    }

    if (market.status !== 'active') {
      return NextResponse.json(
        { error: 'Market is not active' },
        { status: 400 }
      );
    }

    if (!market.app_session_id) {
      return NextResponse.json(
        { error: 'Market does not have Yellow Network integration' },
        { status: 400 }
      );
    }

    // Initialize Yellow client with user's private key (in real app, use wallet connect)
    // For now, we'll use a test private key or require it in the request
    const userPrivateKey = process.env.YELLOW_USER_PRIVATE_KEY;
    if (!userPrivateKey) {
      return NextResponse.json(
        { error: 'User wallet not configured. Please connect your wallet.' },
        { status: 400 }
      );
    }

    const yellowClient = new YellowClient(userPrivateKey as Hex);
    await yellowClient.connect();

    // Determine which pool to bet on
    const poolAddress = position === 'yes' ? market.pool_yes_address : market.pool_no_address;

    // Submit bet as DEPOSIT intent to the App Session
    await yellowClient.submitBet(
      market.app_session_id as Hex,
      poolAddress as Hex,
      amount
    );

    console.log(`✅ Bet submitted to Yellow Network`);

    // Update market amounts in database
    const currentYesAmount = BigInt(market.yes_amount || '0');
    const currentNoAmount = BigInt(market.no_amount || '0');
    const betAmount = BigInt(Math.floor(amount * 1e6)); // Convert to smallest unit (6 decimals)

    const newYesAmount = position === 'yes' ? currentYesAmount + betAmount : currentYesAmount;
    const newNoAmount = position === 'no' ? currentNoAmount + betAmount : currentNoAmount;

    // Calculate new probabilities (simple AMM formula)
    const totalVolume = newYesAmount + newNoAmount;
    const newYesPrice = totalVolume > 0n ? Number((newYesAmount * 100n) / totalVolume) : 50;
    const newNoPrice = 100 - newYesPrice;

    // Update market
    const { error: updateError } = await supabase
      .from('markets')
      .update({
        yes_amount: newYesAmount.toString(),
        no_amount: newNoAmount.toString(),
        yes_price: newYesPrice,
        no_price: newNoPrice,
        volume: market.volume + amount,
      } as any)
      .eq('id', marketId);

    await yellowClient.disconnect();

    if (updateError) {
      console.error('Failed to update market:', updateError);
      return NextResponse.json(
        { error: 'Bet placed but failed to update market display' },
        { status: 500 }
      );
    }

    console.log(`✅ Market updated: YES ${newYesPrice}% / NO ${newNoPrice}%`);

    return NextResponse.json({
      success: true,
      bet: {
        marketId,
        position,
        amount,
        newYesPrice,
        newNoPrice,
      },
    });
  } catch (error) {
    console.error('Bet placement failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
