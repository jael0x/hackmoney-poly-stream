'use client';

import { useState } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Camera,
  Wallet,
  ArrowDownToLine,
  Gift,
  History,
  ArrowUpRight,
  ArrowDownRight,
  Coins,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';

interface Profile {
  id: string;
  username: string | null;
  avatar_url: string | null;
  balance: number | null;
  created_at: string | null;
}

interface Transaction {
  id: string;
  user_id: string;
  type: string;
  amount: number;
  description: string | null;
  created_at: string;
}

interface ProfileContentProps {
  user: User;
  profile: Profile | null;
  transactions: Transaction[];
}

export function ProfileContent({ user, profile, transactions }: ProfileContentProps) {
  const router = useRouter();
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || '');
  const [isEditingAvatar, setIsEditingAvatar] = useState(false);
  const [isDepositing, setIsDepositing] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);
  const [depositAmount, setDepositAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const balance = profile?.balance ?? 0;
  const initials = profile?.username?.slice(0, 2).toUpperCase() || user.email?.slice(0, 2).toUpperCase() || 'U';

  const handleAvatarUpdate = async () => {
    if (!avatarUrl.trim()) return;

    setLoading(true);
    setError('');

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ avatar_url: avatarUrl })
      .eq('id', user.id);

    if (updateError) {
      setError('Failed to update avatar');
    } else {
      setIsEditingAvatar(false);
      router.refresh();
    }
    setLoading(false);
  };

  const handleDeposit = async () => {
    const amount = parseFloat(depositAmount);
    if (isNaN(amount) || amount <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    setLoading(true);
    setError('');

    const { error: txError } = await supabase
      .from('transactions')
      .insert({
        user_id: user.id,
        type: 'deposit',
        amount: amount,
        description: 'Token deposit',
      });

    if (txError) {
      setError('Failed to process deposit');
      setLoading(false);
      return;
    }

    const { error: balanceError } = await supabase
      .from('profiles')
      .update({ balance: balance + amount })
      .eq('id', user.id);

    if (balanceError) {
      setError('Failed to update balance');
    } else {
      setDepositAmount('');
      setIsDepositing(false);
      router.refresh();
    }
    setLoading(false);
  };

  const handleClaim = async () => {
    setLoading(true);
    setError('');

    const claimAmount = 100;

    const { error: txError } = await supabase
      .from('transactions')
      .insert({
        user_id: user.id,
        type: 'claim',
        amount: claimAmount,
        description: 'Daily token claim',
      });

    if (txError) {
      setError('Failed to process claim');
      setLoading(false);
      return;
    }

    const { error: balanceError } = await supabase
      .from('profiles')
      .update({ balance: balance + claimAmount })
      .eq('id', user.id);

    if (balanceError) {
      setError('Failed to update balance');
    } else {
      setIsClaiming(false);
      router.refresh();
    }
    setLoading(false);
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'deposit':
        return <ArrowDownToLine className="h-4 w-4 text-green-400" />;
      case 'claim':
        return <Gift className="h-4 w-4 text-blue-400" />;
      case 'bet':
        return <ArrowUpRight className="h-4 w-4 text-orange-400" />;
      case 'win':
        return <ArrowDownRight className="h-4 w-4 text-emerald-400" />;
      default:
        return <Coins className="h-4 w-4 text-gray-400" />;
    }
  };

  const getTransactionColor = (type: string) => {
    switch (type) {
      case 'deposit':
      case 'claim':
      case 'win':
        return 'text-green-400';
      case 'bet':
      case 'withdrawal':
        return 'text-red-400';
      default:
        return 'text-gray-400';
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
        <div className="relative group">
          <Avatar className="h-24 w-24 border-4 border-gray-800">
            <AvatarImage src={profile?.avatar_url || ''} alt={profile?.username || 'User'} />
            <AvatarFallback className="bg-gradient-to-br from-blue-600 to-cyan-600 text-2xl font-bold text-white">
              {initials}
            </AvatarFallback>
          </Avatar>
          <Dialog open={isEditingAvatar} onOpenChange={setIsEditingAvatar}>
            <DialogTrigger asChild>
              <button className="absolute bottom-0 right-0 p-2 bg-gray-800 rounded-full border border-gray-700 hover:bg-gray-700 transition-colors">
                <Camera className="h-4 w-4 text-gray-300" />
              </button>
            </DialogTrigger>
            <DialogContent className="bg-gray-900 border-gray-800">
              <DialogHeader>
                <DialogTitle className="text-white">Update Profile Photo</DialogTitle>
                <DialogDescription className="text-gray-400">
                  Enter the URL of your new profile photo
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="avatar-url" className="text-gray-300">Image URL</Label>
                  <Input
                    id="avatar-url"
                    value={avatarUrl}
                    onChange={(e) => setAvatarUrl(e.target.value)}
                    placeholder="https://example.com/photo.jpg"
                    className="bg-gray-800 border-gray-700 text-white"
                  />
                </div>
                {avatarUrl && (
                  <div className="flex justify-center">
                    <Avatar className="h-20 w-20">
                      <AvatarImage src={avatarUrl} alt="Preview" />
                      <AvatarFallback className="bg-gray-700">{initials}</AvatarFallback>
                    </Avatar>
                  </div>
                )}
                {error && <p className="text-red-400 text-sm">{error}</p>}
                <Button
                  onClick={handleAvatarUpdate}
                  disabled={loading || !avatarUrl.trim()}
                  className="w-full bg-blue-600 hover:bg-blue-700"
                >
                  {loading ? 'Updating...' : 'Update Photo'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="flex-1">
          <h1 className="text-3xl font-bold text-white">
            {profile?.username || 'User'}
          </h1>
          <p className="text-gray-400">{user.email}</p>
          {profile?.created_at && (
            <p className="text-sm text-gray-500 mt-1">
              Member since {format(new Date(profile.created_at), 'MMMM yyyy')}
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-600/20 rounded-lg">
                  <Wallet className="h-5 w-5 text-blue-400" />
                </div>
                <div>
                  <CardTitle className="text-white text-lg">Wallet</CardTitle>
                  <CardDescription className="text-gray-400">Your token balance</CardDescription>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2 mb-6">
              <span className="text-4xl font-bold text-white">{balance.toLocaleString()}</span>
              <span className="text-gray-400 text-lg">tokens</span>
            </div>

            <div className="flex gap-3">
              <Dialog open={isDepositing} onOpenChange={setIsDepositing}>
                <DialogTrigger asChild>
                  <Button className="flex-1 bg-green-600 hover:bg-green-700">
                    <ArrowDownToLine className="h-4 w-4 mr-2" />
                    Deposit
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-gray-900 border-gray-800">
                  <DialogHeader>
                    <DialogTitle className="text-white">Deposit Tokens</DialogTitle>
                    <DialogDescription className="text-gray-400">
                      Add tokens to your wallet
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 pt-4">
                    <div className="space-y-2">
                      <Label htmlFor="deposit-amount" className="text-gray-300">Amount</Label>
                      <Input
                        id="deposit-amount"
                        type="number"
                        min="1"
                        value={depositAmount}
                        onChange={(e) => setDepositAmount(e.target.value)}
                        placeholder="Enter amount"
                        className="bg-gray-800 border-gray-700 text-white"
                      />
                    </div>
                    <div className="flex gap-2">
                      {[100, 500, 1000].map((amount) => (
                        <Button
                          key={amount}
                          variant="outline"
                          size="sm"
                          onClick={() => setDepositAmount(amount.toString())}
                          className="flex-1 border-gray-700 text-gray-300 hover:bg-gray-800"
                        >
                          {amount}
                        </Button>
                      ))}
                    </div>
                    {error && <p className="text-red-400 text-sm">{error}</p>}
                    <Button
                      onClick={handleDeposit}
                      disabled={loading || !depositAmount}
                      className="w-full bg-green-600 hover:bg-green-700"
                    >
                      {loading ? 'Processing...' : 'Deposit Tokens'}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>

              <Dialog open={isClaiming} onOpenChange={setIsClaiming}>
                <DialogTrigger asChild>
                  <Button className="flex-1 bg-blue-600 hover:bg-blue-700">
                    <Gift className="h-4 w-4 mr-2" />
                    Claim
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-gray-900 border-gray-800">
                  <DialogHeader>
                    <DialogTitle className="text-white">Claim Free Tokens</DialogTitle>
                    <DialogDescription className="text-gray-400">
                      Get your daily free tokens
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 pt-4">
                    <div className="text-center py-6">
                      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-600/20 mb-4">
                        <Gift className="h-8 w-8 text-blue-400" />
                      </div>
                      <p className="text-3xl font-bold text-white mb-2">100 tokens</p>
                      <p className="text-gray-400">Claim your daily bonus!</p>
                    </div>
                    {error && <p className="text-red-400 text-sm text-center">{error}</p>}
                    <Button
                      onClick={handleClaim}
                      disabled={loading}
                      className="w-full bg-blue-600 hover:bg-blue-700"
                    >
                      {loading ? 'Claiming...' : 'Claim Tokens'}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gray-800 rounded-lg">
                <History className="h-5 w-5 text-gray-400" />
              </div>
              <div>
                <CardTitle className="text-white text-lg">Recent Activity</CardTitle>
                <CardDescription className="text-gray-400">Your latest transactions</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {transactions.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500">No transactions yet</p>
                <p className="text-sm text-gray-600 mt-1">
                  Deposit or claim tokens to get started
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {transactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-gray-800 rounded-lg">
                        {getTransactionIcon(tx.type)}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white capitalize">
                          {tx.type}
                        </p>
                        <p className="text-xs text-gray-500">
                          {format(new Date(tx.created_at), 'MMM d, h:mm a')}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`font-semibold ${getTransactionColor(tx.type)}`}>
                        {tx.type === 'bet' || tx.type === 'withdrawal' ? '-' : '+'}
                        {tx.amount.toLocaleString()}
                      </p>
                      <Badge variant="outline" className="text-xs border-gray-700 text-gray-400">
                        tokens
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
