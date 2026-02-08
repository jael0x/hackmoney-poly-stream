/**
 * Twitch Oracle
 *
 * Resolves prediction markets by verifying Twitch API metrics
 */

import { getUserByLogin, getFollowerCount, getLiveStreams } from '@/lib/twitch/client';
import { supabase } from '@/lib/supabase/client';
import { YellowClient } from './client';
import type { Address, Hex } from 'viem';
import type { PredictionMarket, MarketType, OracleResolutionData } from './types';

export class TwitchOracle {
  private yellowClient: YellowClient;
  private oracleAddress: Address;

  constructor(yellowClient: YellowClient, oracleAddress: Address) {
    this.yellowClient = yellowClient;
    this.oracleAddress = oracleAddress;
  }

  /**
   * Get current value of Twitch metric for a streamer
   */
  private async getTwitchMetric(
    twitchUsername: string,
    metric: string
  ): Promise<number> {
    try {
      const userData = await getUserByLogin(twitchUsername);

      if (!userData) {
        throw new Error(`Twitch user not found: ${twitchUsername}`);
      }

      switch (metric) {
        case 'followers_count':
          const followers = await getFollowerCount(userData.id);
          return followers;

        case 'viewer_count':
          const streams = await getLiveStreams();
          const stream = streams.find((s) => s.user_login === twitchUsername);
          return stream?.viewer_count || 0;

        default:
          throw new Error(`Unknown metric: ${metric}`);
      }
    } catch (error) {
      console.error('Failed to fetch Twitch metric:', error);
      throw error;
    }
  }

  /**
   * Resolve a single market by checking Twitch API
   */
  async resolveMarket(marketId: string): Promise<OracleResolutionData> {
    try {
      console.log(`🔮 Oracle resolving market ${marketId}...`);

      // Fetch market from database
      const { data: market, error } = await supabase
        .from('markets')
        .select(
          `
          *,
          streamers (
            id,
            name,
            slug
          )
        `
        )
        .eq('id', marketId)
        .single();

      if (error || !market) {
        throw new Error('Market not found');
      }

      if (market.status !== 'closed') {
        throw new Error('Market is not closed yet');
      }

      if (!market.streamers) {
        throw new Error('Market has no associated streamer');
      }

      // Get current Twitch metric value
      // Type cast needed because database types haven't been regenerated yet
      const marketWithYellowFields = market as any;
      const actualValue = await this.getTwitchMetric(
        market.streamers.slug,
        marketWithYellowFields.twitch_metric
      );

      // Determine winner based on target value
      const winner: 'yes' | 'no' =
        actualValue >= marketWithYellowFields.target_value ? 'yes' : 'no';

      const resolutionData: OracleResolutionData = {
        market_id: marketId,
        twitch_metric: marketWithYellowFields.twitch_metric,
        target_value: marketWithYellowFields.target_value,
        actual_value: actualValue,
        winner,
        resolved_at: new Date().toISOString(),
      };

      console.log('✅ Oracle resolution:', resolutionData);

      // Update market in database
      await supabase
        .from('markets')
        .update({
          status: 'resolved',
          winner,
          resolved_at: resolutionData.resolved_at,
        })
        .eq('id', marketId);

      return resolutionData;
    } catch (error) {
      console.error('Failed to resolve market:', error);
      throw error;
    }
  }

  /**
   * Distribute winnings by closing App Session
   */
  async distributeWinnings(market: PredictionMarket): Promise<void> {
    try {
      if (!market.app_session_id) {
        throw new Error('Market has no app_session_id');
      }

      console.log(`💰 Distributing winnings for market ${market.id}...`);

      // Get current allocations from App Session
      const appDef = await this.yellowClient.getAppDefinition(
        market.app_session_id as Hex
      );

      const yesPoolAddress = market.pool_yes_address as Address;
      const noPoolAddress = market.pool_no_address as Address;
      const totalYes = BigInt(market.yes_amount);
      const totalNo = BigInt(market.no_amount);
      const totalVolume = totalYes + totalNo;

      // Determine final allocations based on winner
      const finalAllocations =
        market.winner === 'yes'
          ? [
              // All funds go to YES pool (winners)
              {
                participant: yesPoolAddress,
                asset: 'ytest.usd',
                amount: totalVolume.toString(),
              },
              // NO pool gets 0
              {
                participant: noPoolAddress,
                asset: 'ytest.usd',
                amount: '0',
              },
              // Oracle gets 0
              {
                participant: this.oracleAddress,
                asset: 'ytest.usd',
                amount: '0',
              },
            ]
          : [
              // YES pool gets 0
              {
                participant: yesPoolAddress,
                asset: 'ytest.usd',
                amount: '0',
              },
              // All funds go to NO pool (winners)
              {
                participant: noPoolAddress,
                asset: 'ytest.usd',
                amount: totalVolume.toString(),
              },
              // Oracle gets 0
              {
                participant: this.oracleAddress,
                asset: 'ytest.usd',
                amount: '0',
              },
            ];

      // Close App Session with final distribution
      await this.yellowClient.closeAppSession(
        market.app_session_id as Hex,
        finalAllocations
      );

      console.log('✅ Winnings distributed successfully');
    } catch (error) {
      console.error('Failed to distribute winnings:', error);
      throw error;
    }
  }

  /**
   * Check all closed markets that need resolution
   */
  async processClosedMarkets(): Promise<void> {
    try {
      console.log('🔍 Checking for markets to resolve...');

      const { data: markets, error } = await supabase
        .from('markets')
        .select(
          `
          *,
          streamers (
            id,
            name,
            slug
          )
        `
        )
        .eq('status', 'closed')
        .order('created_at', { ascending: true });

      if (error) {
        throw error;
      }

      if (!markets || markets.length === 0) {
        console.log('No closed markets to resolve');
        return;
      }

      console.log(`Found ${markets.length} closed markets to resolve`);

      for (const market of markets) {
        try {
          // Resolve market
          const resolution = await this.resolveMarket(market.id);

          // Distribute winnings
          await this.distributeWinnings(market as any);

          console.log(`✅ Market ${market.id} resolved and distributed`);
        } catch (error) {
          console.error(`Failed to process market ${market.id}:`, error);
          // Continue with next market
        }
      }
    } catch (error) {
      console.error('Failed to process closed markets:', error);
      throw error;
    }
  }

  /**
   * Close markets that have reached their end date
   */
  async closeExpiredMarkets(): Promise<void> {
    try {
      console.log('⏰ Checking for expired markets...');

      const now = new Date().toISOString();

      const { data: markets, error } = await supabase
        .from('markets')
        .select('*')
        .eq('status', 'active')
        .lte('end_date', now);

      if (error) {
        throw error;
      }

      if (!markets || markets.length === 0) {
        console.log('No expired markets to close');
        return;
      }

      console.log(`Found ${markets.length} expired markets`);

      for (const market of markets) {
        try {
          await supabase
            .from('markets')
            .update({ status: 'closed' })
            .eq('id', market.id);

          console.log(`✅ Closed expired market ${market.id}`);
        } catch (error) {
          console.error(`Failed to close market ${market.id}:`, error);
        }
      }
    } catch (error) {
      console.error('Failed to close expired markets:', error);
      throw error;
    }
  }

  /**
   * Run complete oracle cycle: close expired → resolve closed → distribute
   */
  async run(): Promise<void> {
    console.log('🔮 Oracle starting...');

    try {
      // Step 1: Close expired markets
      await this.closeExpiredMarkets();

      // Step 2: Resolve closed markets and distribute winnings
      await this.processClosedMarkets();

      console.log('✅ Oracle cycle completed');
    } catch (error) {
      console.error('Oracle cycle failed:', error);
      throw error;
    }
  }
}
