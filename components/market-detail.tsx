'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase/client';
import {
  TrendingUp,
  Users,
  Clock,
  Activity,
  AlertCircle,
  Wallet,
  ArrowLeft,
  Check,
} from 'lucide-react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';

interface Market {
  id: string;
  question: string;
  description: string | null;
  yes_price: number;
  no_price: number;
  volume: number;
  end_date: string | null;
  status: string;
  created_at: string;
  streamers?: {
    id: string;
    name: string;
    slug: string;
  } | null;
}

interface MarketDetailProps {
  market: Market;
  userBalance: number;
  isAuthenticated: boolean;
}

export function MarketDetail({ market, userBalance, isAuthenticated }: MarketDetailProps) {
  const router = useRouter();
  const [selectedOutcome, setSelectedOutcome] = useState<'yes' | 'no' | null>(null);
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const yesPrice = Number(market.yes_price);
  const noPrice = Number(market.no_price);
  const volume = Number(market.volume);

  const participants = Math.floor(volume / 50) + Math.floor(Math.random() * 20) + 10;

  const getTimeRemaining = () => {
    if (!market.end_date) return 'No deadline';
    const endDate = new Date(market.end_date);
    const now = new Date();
    if (endDate <= now) return 'Ended';
    return formatDistanceToNow(endDate, { addSuffix: false }) + ' left';
  };

  const formatVolume = (vol: number) => {
    if (vol >= 1000000) return `$${(vol / 1000000).toFixed(2)}M`;
    if (vol >= 1000) return `$${(vol / 1000).toFixed(1)}K`;
    return `$${vol.toFixed(0)}`;
  };

  const getImpliedOdds = (price: number) => {
    if (price <= 0) return '0.00';
    return (100 / price).toFixed(2);
  };

  const calculatePotentialReturn = () => {
    if (!selectedOutcome || !amount) return 0;
    const betAmount = parseFloat(amount);
    if (isNaN(betAmount) || betAmount <= 0) return 0;
    const price = selectedOutcome === 'yes' ? yesPrice : noPrice;
    return (betAmount * (100 / price)).toFixed(2);
  };

  const handlePlaceBet = async () => {
    if (!selectedOutcome || !amount || !isAuthenticated) return;

    const betAmount = parseFloat(amount);
    if (isNaN(betAmount) || betAmount <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    if (betAmount > userBalance) {
      setError('Insufficient balance');
      return;
    }

    setLoading(true);
    setError('');

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError('Please sign in to place a prediction');
      setLoading(false);
      return;
    }

    const { error: txError } = await supabase
      .from('transactions')
      .insert({
        user_id: user.id,
        type: 'bet',
        amount: betAmount,
        description: `${selectedOutcome.toUpperCase()} on: ${market.question.slice(0, 50)}`,
      });

    if (txError) {
      setError('Failed to process bet');
      setLoading(false);
      return;
    }

    const { error: balanceError } = await supabase
      .from('profiles')
      .update({ balance: userBalance - betAmount })
      .eq('id', user.id);

    if (balanceError) {
      setError('Failed to update balance');
      setLoading(false);
      return;
    }

    const newVolume = volume + betAmount;
    await supabase
      .from('markets')
      .update({ volume: newVolume })
      .eq('id', market.id);

    router.refresh();
    setAmount('');
    setSelectedOutcome(null);
    setLoading(false);
  };

  const canPlaceBet = isAuthenticated && userBalance > 0 && selectedOutcome && amount && parseFloat(amount) > 0;

  return (
    <div className="space-y-6">
      {market.streamers && (
        <Link
          href={`/streamer/${market.streamers.slug}`}
          className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to {market.streamers.name}</span>
        </Link>
      )}

      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <Badge
            variant="outline"
            className={`${
              market.status === 'active'
                ? 'border-green-500 text-green-400 bg-green-500/10'
                : 'border-gray-600 text-gray-400'
            }`}
          >
            {market.status === 'active' ? 'Active' : market.status}
          </Badge>
          {market.streamers && (
            <Badge variant="outline" className="border-gray-700 text-gray-400">
              {market.streamers.name}
            </Badge>
          )}
        </div>
        <h1 className="text-3xl font-bold text-white leading-tight">
          {market.question}
        </h1>
        {market.description && (
          <p className="text-gray-400 text-lg">
            {market.description}
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gray-900 border-gray-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-gray-400 mb-1">
              <TrendingUp className="h-4 w-4" />
              <span className="text-xs font-medium uppercase">Volume</span>
            </div>
            <p className="text-xl font-bold text-white">{formatVolume(volume)}</p>
          </CardContent>
        </Card>

        <Card className="bg-gray-900 border-gray-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-gray-400 mb-1">
              <Users className="h-4 w-4" />
              <span className="text-xs font-medium uppercase">Participants</span>
            </div>
            <p className="text-xl font-bold text-white">{participants}</p>
          </CardContent>
        </Card>

        <Card className="bg-gray-900 border-gray-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-gray-400 mb-1">
              <Clock className="h-4 w-4" />
              <span className="text-xs font-medium uppercase">Time Left</span>
            </div>
            <p className="text-xl font-bold text-white">{getTimeRemaining()}</p>
          </CardContent>
        </Card>

        <Card className="bg-gray-900 border-gray-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-gray-400 mb-1">
              <Activity className="h-4 w-4" />
              <span className="text-xs font-medium uppercase">Status</span>
            </div>
            <p className="text-xl font-bold text-green-400 capitalize">{market.status}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card
          className={`bg-gray-900 border-2 cursor-pointer transition-all ${
            selectedOutcome === 'yes'
              ? 'border-green-500 ring-2 ring-green-500/20'
              : 'border-gray-800 hover:border-gray-700'
          }`}
          onClick={() => setSelectedOutcome('yes')}
        >
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  selectedOutcome === 'yes' ? 'bg-green-500' : 'bg-green-500/20'
                }`}>
                  {selectedOutcome === 'yes' ? (
                    <Check className="h-5 w-5 text-white" />
                  ) : (
                    <span className="text-green-400 font-bold">Y</span>
                  )}
                </div>
                <span className="text-xl font-bold text-white">YES</span>
              </div>
              <span className="text-3xl font-bold text-green-400">{yesPrice.toFixed(0)}%</span>
            </div>

            <div className="space-y-4">
              <div className="h-3 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500 transition-all"
                  style={{ width: `${yesPrice}%` }}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500 uppercase mb-1">Total Stake</p>
                  <p className="text-lg font-semibold text-white">
                    {formatVolume(volume * (yesPrice / 100))}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase mb-1">Implied Odds</p>
                  <p className="text-lg font-semibold text-white">{getImpliedOdds(yesPrice)}x</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card
          className={`bg-gray-900 border-2 cursor-pointer transition-all ${
            selectedOutcome === 'no'
              ? 'border-red-500 ring-2 ring-red-500/20'
              : 'border-gray-800 hover:border-gray-700'
          }`}
          onClick={() => setSelectedOutcome('no')}
        >
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  selectedOutcome === 'no' ? 'bg-red-500' : 'bg-red-500/20'
                }`}>
                  {selectedOutcome === 'no' ? (
                    <Check className="h-5 w-5 text-white" />
                  ) : (
                    <span className="text-red-400 font-bold">N</span>
                  )}
                </div>
                <span className="text-xl font-bold text-white">NO</span>
              </div>
              <span className="text-3xl font-bold text-red-400">{noPrice.toFixed(0)}%</span>
            </div>

            <div className="space-y-4">
              <div className="h-3 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-red-500 transition-all"
                  style={{ width: `${noPrice}%` }}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500 uppercase mb-1">Total Stake</p>
                  <p className="text-lg font-semibold text-white">
                    {formatVolume(volume * (noPrice / 100))}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase mb-1">Implied Odds</p>
                  <p className="text-lg font-semibold text-white">{getImpliedOdds(noPrice)}x</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-gray-900 border-gray-800">
        <CardContent className="p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Place Prediction</h3>

          {!isAuthenticated ? (
            <div className="text-center py-6">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-orange-500/20 mb-3">
                <AlertCircle className="h-6 w-6 text-orange-400" />
              </div>
              <p className="text-gray-300 mb-4">Sign in to place predictions</p>
              <Button asChild className="bg-blue-600 hover:bg-blue-700">
                <Link href="/login">Sign In</Link>
              </Button>
            </div>
          ) : userBalance === 0 ? (
            <div className="text-center py-6">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-orange-500/20 mb-3">
                <Wallet className="h-6 w-6 text-orange-400" />
              </div>
              <p className="text-gray-300 mb-2">Your balance is empty</p>
              <p className="text-gray-500 text-sm mb-4">
                Deposit tokens to start placing predictions
              </p>
              <Button asChild className="bg-green-600 hover:bg-green-700">
                <Link href="/profile">Deposit Tokens</Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
                <span className="text-gray-400">Selected Outcome</span>
                {selectedOutcome ? (
                  <Badge
                    className={`${
                      selectedOutcome === 'yes'
                        ? 'bg-green-500/20 text-green-400 border-green-500'
                        : 'bg-red-500/20 text-red-400 border-red-500'
                    }`}
                  >
                    {selectedOutcome.toUpperCase()}
                  </Badge>
                ) : (
                  <span className="text-gray-500 text-sm">Select YES or NO above</span>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm text-gray-400">Amount (tokens)</label>
                  <span className="text-sm text-gray-500">
                    Balance: <span className="text-white font-medium">{userBalance.toLocaleString()}</span>
                  </span>
                </div>
                <Input
                  type="number"
                  min="1"
                  max={userBalance}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="Enter amount"
                  className="bg-gray-800 border-gray-700 text-white"
                />
                <div className="flex gap-2 mt-2">
                  {[10, 50, 100, 500].map((preset) => (
                    <Button
                      key={preset}
                      variant="outline"
                      size="sm"
                      onClick={() => setAmount(Math.min(preset, userBalance).toString())}
                      className="flex-1 border-gray-700 text-gray-300 hover:bg-gray-800"
                      disabled={preset > userBalance}
                    >
                      {preset}
                    </Button>
                  ))}
                </div>
              </div>

              {selectedOutcome && amount && parseFloat(amount) > 0 && (
                <div className="p-3 bg-gray-800 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Potential Return</span>
                    <span className="text-xl font-bold text-green-400">
                      {calculatePotentialReturn()} tokens
                    </span>
                  </div>
                </div>
              )}

              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                  <p className="text-red-400 text-sm">{error}</p>
                </div>
              )}

              <Button
                onClick={handlePlaceBet}
                disabled={!canPlaceBet || loading}
                className={`w-full h-12 text-lg font-semibold ${
                  selectedOutcome === 'yes'
                    ? 'bg-green-600 hover:bg-green-700'
                    : selectedOutcome === 'no'
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-blue-600 hover:bg-blue-700'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {loading
                  ? 'Processing...'
                  : !selectedOutcome
                  ? 'Select an Outcome'
                  : !amount
                  ? 'Enter Amount'
                  : `Place ${selectedOutcome.toUpperCase()} Prediction`}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
