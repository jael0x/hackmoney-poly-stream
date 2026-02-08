'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, TrendingUp, TrendingDown, Lock } from 'lucide-react';
import type { Address, Hex } from 'viem';
import type { YellowClient } from '@/lib/yellow/client';

interface InlineMarketOperationsProps {
  sessionId: string;
  session: any;
  yellowClient: YellowClient | null;
  userAddress?: Address;
  onUpdate?: () => void;
  compact?: boolean;
}

export function InlineMarketOperations({
  sessionId,
  session,
  yellowClient,
  userAddress,
  onUpdate,
  compact = false
}: InlineMarketOperationsProps) {
  const [betAmount, setBetAmount] = useState('1');
  const [isPlacingBet, setIsPlacingBet] = useState(false);
  const [activeBet, setActiveBet] = useState<'yes' | 'no' | null>(null);
  const [isClosing, setIsClosing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isJoining, setIsJoining] = useState(false);
  const [joinAmount, setJoinAmount] = useState('10');

  // Extract pool amounts
  const yesPool = session.allocations?.find((a: any) =>
    a.participant === '0x0000000000000000000000000000000000000001'
  );
  const noPool = session.allocations?.find((a: any) =>
    a.participant === '0x0000000000000000000000000000000000000002'
  );

  const yesAmount = BigInt(yesPool?.amount || '0');
  const noAmount = BigInt(noPool?.amount || '0');
  const totalLocked = yesAmount + noAmount;

  // Calculate odds
  const yesOdds = totalLocked === 0n ? 50 : Number((yesAmount * 100n) / totalLocked);
  const noOdds = 100 - yesOdds;

  const handleQuickBet = async (position: 'yes' | 'no') => {
    if (!yellowClient || !userAddress) return;

    const amount = parseFloat(betAmount);
    if (isNaN(amount) || amount <= 0) {
      setErrorMessage('Please enter a valid amount');
      return;
    }

    setIsPlacingBet(true);
    setActiveBet(position);
    setErrorMessage(null);

    try {
      const amountInSmallestUnit = (amount * 1e6).toString();
      const poolAddress = position === 'yes'
        ? '0x0000000000000000000000000000000000000001' as Address
        : '0x0000000000000000000000000000000000000002' as Address;

      console.log(`Placing bet: ${amount} ytest.usd on ${position.toUpperCase()}`);

      // Ensure user is a participant (check case-insensitive)
      const isUserParticipant = session.participants?.some((p: string) =>
        p.toLowerCase() === userAddress.toLowerCase()
      );

      if (!isUserParticipant) {
        setErrorMessage('You are not a participant in this market. Please create a new market to start betting.');
        return;
      }

      // Submit bet - the client will fetch current state and handle versioning
      await yellowClient.submitBet(
        sessionId as Hex,
        poolAddress,
        'ytest.usd',
        amountInSmallestUnit
      );

      setErrorMessage(null);
      console.log('✅ Bet placed successfully!');

      // Refresh the session data
      if (onUpdate) {
        setTimeout(onUpdate, 1000);
      }
    } catch (error: any) {
      console.error('Bet failed:', error);

      // Parse error message for user feedback
      let userMessage = 'Failed to place bet';
      if (error.message?.includes('balance')) {
        userMessage = 'Insufficient balance in this market';
      } else if (error.message?.includes('participant')) {
        userMessage = 'You need to be a participant with funds in this market';
      } else if (error.message?.includes('version')) {
        userMessage = 'Market state changed, please try again';
      } else if (error.message?.includes('closed')) {
        userMessage = 'This market is closed';
      }

      setErrorMessage(userMessage);
    } finally {
      setIsPlacingBet(false);
      setActiveBet(null);
    }
  };

  const handleJoinMarket = async () => {
    if (!yellowClient || !userAddress) return;

    const amount = parseFloat(joinAmount);
    if (isNaN(amount) || amount <= 0) {
      setErrorMessage('Please enter a valid join amount');
      return;
    }

    setIsJoining(true);
    setErrorMessage(null);

    try {
      const amountInSmallestUnit = (amount * 1e6).toString();

      console.log(`Joining market with ${amount} ytest.usd...`);

      await yellowClient.joinMarket(
        sessionId as Hex,
        amountInSmallestUnit,
        'ytest.usd'
      );

      setErrorMessage(null);
      console.log('✅ Successfully joined market!');

      // Refresh the session data
      if (onUpdate) {
        setTimeout(onUpdate, 1000);
      }
    } catch (error: any) {
      console.error('Failed to join market:', error);

      let userMessage = 'Failed to join market';
      if (error.message?.includes('balance')) {
        userMessage = 'Insufficient balance to join market';
      } else if (error.message?.includes('already')) {
        userMessage = 'You are already a participant';
      }

      setErrorMessage(userMessage);
    } finally {
      setIsJoining(false);
    }
  };

  const handleCloseMarket = async () => {
    if (!yellowClient || !userAddress) return;

    setIsClosing(true);
    setErrorMessage(null);

    try {
      console.log('Closing market and returning funds...');
      console.log('Session details:', {
        sessionId,
        participants: session.participants,
        weights: session.weights,
        quorum: session.quorum,
        userAddress,
        status: session.status
      });

      // Check if user has the authority to close
      const userIndex = session.participants?.findIndex(
        (p: string) => p.toLowerCase() === userAddress.toLowerCase()
      );

      if (userIndex === -1) {
        setErrorMessage('You are not a participant in this session');
        return;
      }

      const userWeight = session.weights?.[userIndex] || 0;
      console.log(`User weight: ${userWeight}, Required quorum: ${session.quorum || 100}`);

      if (userWeight < (session.quorum || 100)) {
        setErrorMessage(`Insufficient weight to close session. You have ${userWeight}% but need ${session.quorum || 100}%`);
        return;
      }

      // For demo: return all funds to user
      // In production, this would be based on actual market resolution
      const finalAllocations = [{
        participant: userAddress,
        amount: totalLocked.toString(),
        asset: 'ytest.usd'
      }];

      console.log('Attempting to close with allocations:', finalAllocations);

      await yellowClient.closeAppSession(
        sessionId as Hex,
        finalAllocations
      );

      console.log('✅ Session closed successfully');
      if (onUpdate) setTimeout(onUpdate, 1000);
    } catch (error: any) {
      console.error('Market close failed:', error);
      const errorMsg = error?.message || 'Failed to close market';
      setErrorMessage(errorMsg);
    } finally {
      setIsClosing(false);
    }
  };

  const formatAmount = (amount: bigint) => (Number(amount) / 1e6).toFixed(2);

  if (!yellowClient || session.status !== 'open') {
    return null;
  }

  // Check if user is a participant
  const isUserParticipant = session.participants?.some((p: string) =>
    p?.toLowerCase() === userAddress?.toLowerCase()
  );

  if (compact) {
    // Compact mode for embedding in cards
    return (
      <div className="space-y-2 mt-3 pt-3 border-t border-gray-800">
        {errorMessage && (
          <div className="p-2 bg-red-900/50 border border-red-600 rounded text-xs text-red-300">
            {errorMessage}
          </div>
        )}

        {!isUserParticipant ? (
          // Show join market UI
          <div className="space-y-2">
            <p className="text-xs text-yellow-400">You need to join this market to place bets</p>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                value={joinAmount}
                onChange={(e) => setJoinAmount(e.target.value)}
                placeholder="Join amount"
                className="w-32 h-8 bg-gray-950 border-gray-800 text-white text-sm"
                disabled={isJoining}
              />
              <Button
                size="sm"
                onClick={handleJoinMarket}
                disabled={isJoining || !userAddress}
                className="flex-1 bg-blue-600 hover:bg-blue-700 h-8 text-xs"
              >
                {isJoining ? (
                  <>
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    Joining...
                  </>
                ) : (
                  <>Join Market</>
                )}
              </Button>
            </div>
          </div>
        ) : (
          // Show betting UI
          <>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                value={betAmount}
                onChange={(e) => setBetAmount(e.target.value)}
                placeholder="Amount"
                className="w-24 h-8 bg-gray-950 border-gray-800 text-white text-sm"
                disabled={isPlacingBet || isClosing}
              />
              <Button
                size="sm"
                onClick={() => handleQuickBet('yes')}
                disabled={isPlacingBet || isClosing || !userAddress}
                className="flex-1 bg-green-600 hover:bg-green-700 h-8 text-xs"
              >
                {isPlacingBet && activeBet === 'yes' ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <>YES {yesOdds}%</>
                )}
              </Button>
              <Button
                size="sm"
                onClick={() => handleQuickBet('no')}
                disabled={isPlacingBet || isClosing || !userAddress}
                className="flex-1 bg-red-600 hover:bg-red-700 h-8 text-xs"
              >
                {isPlacingBet && activeBet === 'no' ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <>NO {noOdds}%</>
                )}
              </Button>
            </div>
            <Button
              size="sm"
              onClick={handleCloseMarket}
              disabled={isClosing || !userAddress}
              variant="outline"
              className="w-full h-8 text-xs border-orange-600 text-orange-400 hover:bg-orange-600/20"
            >
              {isClosing ? (
                <>
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  Closing...
                </>
              ) : (
                <>
                  <Lock className="h-3 w-3 mr-1" />
                  Close Market
                </>
              )}
            </Button>
          </>
        )}
      </div>
    );
  }

  // Full mode
  return (
    <div className="space-y-3 p-3 bg-gray-950 rounded-lg border border-gray-800">
      {errorMessage && (
        <div className="p-3 bg-red-900/50 border border-red-600 rounded text-sm text-red-300">
          {errorMessage}
        </div>
      )}
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-400">Quick Bet</span>
        <span className="text-xs text-yellow-400">
          TVL: {formatAmount(totalLocked)} ytest.usd
        </span>
      </div>

      {!isUserParticipant ? (
        // Show join market UI
        <div className="space-y-3">
          <div className="p-3 bg-yellow-900/30 border border-yellow-600 rounded text-sm">
            <p className="text-yellow-400 font-semibold mb-1">Join Market</p>
            <p className="text-xs text-gray-300">You need to join this market with initial funds to place bets</p>
          </div>
          <div className="flex gap-2">
            <Input
              type="number"
              value={joinAmount}
              onChange={(e) => setJoinAmount(e.target.value)}
              placeholder="Amount to deposit"
              min="0.01"
              step="0.01"
              className="w-40 bg-gray-900 border-gray-700 text-white"
              disabled={isJoining}
            />
            <Button
              onClick={handleJoinMarket}
              disabled={isJoining || !userAddress}
              className="flex-1 bg-blue-600 hover:bg-blue-700"
            >
              {isJoining ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Joining Market...
                </>
              ) : (
                <>Join with {joinAmount} ytest.usd</>
              )}
            </Button>
          </div>
        </div>
      ) : (
        // Show betting UI
        <>
          <div className="flex gap-2">
            <Input
              type="number"
              value={betAmount}
              onChange={(e) => setBetAmount(e.target.value)}
              placeholder="Amount"
              min="0.01"
              step="0.01"
              className="w-32 bg-gray-900 border-gray-700 text-white"
              disabled={isPlacingBet || isClosing}
            />
            <Button
              onClick={() => handleQuickBet('yes')}
              disabled={isPlacingBet || isClosing || !userAddress}
              className="flex-1 bg-green-600 hover:bg-green-700"
            >
              {isPlacingBet && activeBet === 'yes' ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Betting...
                </>
              ) : (
                <>
                  <TrendingUp className="mr-2 h-4 w-4" />
                  YES {yesOdds}%
                </>
              )}
            </Button>
            <Button
              onClick={() => handleQuickBet('no')}
              disabled={isPlacingBet || isClosing || !userAddress}
              className="flex-1 bg-red-600 hover:bg-red-700"
            >
              {isPlacingBet && activeBet === 'no' ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Betting...
                </>
              ) : (
                <>
                  <TrendingDown className="mr-2 h-4 w-4" />
                  NO {noOdds}%
                </>
              )}
            </Button>
          </div>

          <Button
            onClick={handleCloseMarket}
            disabled={isClosing || !userAddress}
            variant="outline"
            className="w-full border-orange-600 text-orange-400 hover:bg-orange-600/20"
          >
            {isClosing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Closing Market...
              </>
            ) : (
              <>
                <Lock className="mr-2 h-4 w-4" />
                Close Market (Return Funds)
              </>
            )}
          </Button>
        </>
      )}

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="bg-green-950/50 p-2 rounded border border-green-900">
          <div className="text-green-400">YES Pool</div>
          <div className="text-white font-semibold">{formatAmount(yesAmount)} ytest.usd</div>
        </div>
        <div className="bg-red-950/50 p-2 rounded border border-red-900">
          <div className="text-red-400">NO Pool</div>
          <div className="text-white font-semibold">{formatAmount(noAmount)} ytest.usd</div>
        </div>
      </div>
    </div>
  );
}