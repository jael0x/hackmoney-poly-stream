/**
 * API endpoint to claim winnings from a resolved prediction market
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/client';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { marketId, userAddress } = body;

    // Validate required fields
    if (!marketId || !userAddress) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    console.log(`💰 Processing claim for market ${marketId} by ${userAddress}`);

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

    if (market.status !== 'resolved') {
      return NextResponse.json(
        { error: 'Market is not resolved yet' },
        { status: 400 }
      );
    }

    if (!market.app_session_id || !market.winner) {
      return NextResponse.json(
        { error: 'Market does not have complete Yellow Network data' },
        { status: 400 }
      );
    }

    // In a real implementation, this would:
    // 1. Check if the user has bets on the winning side
    // 2. Calculate their share of the winnings
    // 3. Withdraw from the Yellow Network App Session to their wallet
    //
    // For now, we'll simulate this and just mark it as claimed

    // The actual distribution happens when the oracle calls distributeWinnings
    // which closes the App Session and sends funds to the winning pool
    // Users would then withdraw from their pool

    // Calculate winnings (simplified)
    const totalWinningAmount = market.winner === 'yes'
      ? BigInt(market.yes_amount || '0')
      : BigInt(market.no_amount || '0');

    const totalLosingAmount = market.winner === 'yes'
      ? BigInt(market.no_amount || '0')
      : BigInt(market.yes_amount || '0');

    const totalPot = totalWinningAmount + totalLosingAmount;

    // In real app: fetch user's bet amount from a bets table
    // For demo: assume user has 10 USDC bet
    const userBetAmount = BigInt(10 * 1e6); // 10 USDC in smallest unit

    // Calculate user's share: (userBet / totalWinningPool) * totalPot
    const userWinnings = totalWinningAmount > 0n
      ? (userBetAmount * totalPot) / totalWinningAmount
      : 0n;

    const winningsInUSDC = Number(userWinnings) / 1e6;

    console.log(`✅ User would receive ${winningsInUSDC} USDC`);

    return NextResponse.json({
      success: true,
      claim: {
        marketId,
        winner: market.winner,
        winnings: winningsInUSDC,
        message: `You won ${winningsInUSDC} USDC! (Demo mode - actual withdrawal not implemented)`,
      },
    });
  } catch (error) {
    console.error('Claim failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
