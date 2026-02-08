'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { useYellow } from '@/components/providers/yellow-provider';

interface BetButtonProps {
  marketId: string;
  position: 'yes' | 'no';
  currentPrice: number;
  className?: string;
  children: React.ReactNode;
}

export function BetButton({ marketId, position, currentPrice, className, children }: BetButtonProps) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState('10');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { isConnected, address, connect } = useYellow();

  const handleBet = async () => {
    if (!isConnected || !address) {
      await connect();
      return;
    }

    const betAmount = parseFloat(amount);
    if (isNaN(betAmount) || betAmount <= 0) {
      alert('Please enter a valid amount');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/markets/bet', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          marketId,
          position,
          amount: betAmount,
          userAddress: address,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to place bet');
      }

      // Success! Close dialog and refresh
      setOpen(false);
      setAmount('10');

      // Trigger a page refresh to show updated prices
      window.location.reload();
    } catch (error) {
      console.error('Bet error:', error);
      alert(error instanceof Error ? error.message : 'Failed to place bet');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className={className} onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}>
          {children}
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-gray-900 border-gray-800 text-white" onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>
            Buy {position.toUpperCase()} @ {currentPrice}%
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            Place your bet using Yellow Network state channels
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="amount" className="text-white">
              Amount (USDC)
            </Label>
            <Input
              id="amount"
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="10.00"
              className="bg-gray-950 border-gray-800 text-white"
              step="0.01"
              min="0.01"
            />
          </div>
          <div className="rounded-lg bg-gray-950 p-3 border border-gray-800">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-400">Position:</span>
              <span className={position === 'yes' ? 'text-green-400 font-medium' : 'text-red-400 font-medium'}>
                {position.toUpperCase()}
              </span>
            </div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-400">Current price:</span>
              <span className="text-white">{currentPrice}%</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Potential return:</span>
              <span className="text-white">
                ${currentPrice > 0 ? ((parseFloat(amount) || 0) * (100 / currentPrice)).toFixed(2) : '0.00'}
              </span>
            </div>
          </div>
        </div>
        <DialogFooter>
          {!isConnected ? (
            <Button
              onClick={connect}
              className="w-full bg-blue-600 hover:bg-blue-700"
            >
              Connect Wallet
            </Button>
          ) : (
            <Button
              onClick={handleBet}
              disabled={isSubmitting}
              className={`w-full ${position === 'yes' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Placing bet...
                </>
              ) : (
                `Place Bet - $${amount}`
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
