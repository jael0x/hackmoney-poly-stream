'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Trophy } from 'lucide-react';
import { useYellow } from '@/components/providers/yellow-provider';

interface ClaimWinningsButtonProps {
  marketId: string;
  winner: 'yes' | 'no';
  className?: string;
}

export function ClaimWinningsButton({ marketId, winner, className }: ClaimWinningsButtonProps) {
  const [isClaiming, setIsClaiming] = useState(false);
  const { isConnected, address, connect } = useYellow();

  const handleClaim = async () => {
    if (!isConnected || !address) {
      await connect();
      return;
    }

    setIsClaiming(true);

    try {
      const response = await fetch('/api/markets/claim', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          marketId,
          userAddress: address,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to claim winnings');
      }

      // Success!
      alert(data.claim.message);

      // Refresh page to update status
      window.location.reload();
    } catch (error) {
      console.error('Claim error:', error);
      alert(error instanceof Error ? error.message : 'Failed to claim winnings');
    } finally {
      setIsClaiming(false);
    }
  };

  return (
    <Button
      onClick={handleClaim}
      disabled={isClaiming}
      className={`${className} ${winner === 'yes' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}
    >
      {isClaiming ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Claiming...
        </>
      ) : (
        <>
          <Trophy className="mr-2 h-4 w-4" />
          Claim Winnings
        </>
      )}
    </Button>
  );
}
