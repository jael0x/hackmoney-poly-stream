/**
 * Oracle API Endpoint
 *
 * Executes the oracle cycle:
 * 1. Close expired markets
 * 2. Resolve closed markets
 * 3. Distribute winnings
 *
 * Can be called manually or via cron job
 */

import { NextResponse } from 'next/server';
import { YellowClient } from '@/lib/yellow/client';
import { TwitchOracle } from '@/lib/yellow/oracle';
import { YELLOW_CONFIG } from '@/lib/yellow/config';

// Oracle wallet address (should be a secure server-side wallet)
const ORACLE_ADDRESS = process.env.ORACLE_WALLET_ADDRESS as `0x${string}`;
const ORACLE_PRIVATE_KEY = process.env.ORACLE_PRIVATE_KEY as `0x${string}`;

export async function POST(request: Request) {
  try {
    // Optional: Add authentication/authorization here
    // For example, check for a secret token
    const authHeader = request.headers.get('authorization');
    const expectedToken = process.env.ORACLE_API_SECRET;

    if (expectedToken && authHeader !== `Bearer ${expectedToken}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('🔮 Oracle API: Starting oracle cycle...');

    // Initialize Yellow Client
    const yellowClient = new YellowClient({
      wsUrl: YELLOW_CONFIG.CLEARNODE_WS_URL,
    });

    // Connect to Yellow Network
    await yellowClient.connect();

    // Note: In production, you'd authenticate with the oracle's wallet
    // For now, this is a placeholder - the oracle needs to be authenticated
    // to be able to close App Sessions

    // Initialize Oracle
    const oracle = new TwitchOracle(yellowClient, ORACLE_ADDRESS);

    // Run oracle cycle
    await oracle.run();

    // Disconnect
    await yellowClient.disconnect();

    return NextResponse.json({
      success: true,
      message: 'Oracle cycle completed successfully',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Oracle API error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

// GET endpoint to check oracle status
export async function GET() {
  return NextResponse.json({
    status: 'ready',
    oracle_address: ORACLE_ADDRESS || 'not configured',
    message: 'Oracle API is running. Use POST to trigger oracle cycle.',
  });
}
