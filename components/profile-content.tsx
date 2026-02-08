'use client';

import { useState, useEffect } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase/client';
import { useYellow } from '@/components/providers/yellow-provider';
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
  ArrowUpFromLine,
  Gift,
  History,
  ArrowUpRight,
  ArrowDownRight,
  Coins,
  Network,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAccount } from 'wagmi';
import { format } from 'date-fns';
import WalletConnect from './wallet-connect';
import Link from 'next/link';

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
  user: User | null;
  profile: Profile | null;
  transactions: Transaction[];
}

export function ProfileContent({ user, profile, transactions }: ProfileContentProps) {
  const router = useRouter();
  const { client, state, unifiedBalance, refreshBalance, authenticate, isAuthenticating, connect, isConnecting } = useYellow();
  const { address } = useAccount();

  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || '');
  const [isEditingAvatar, setIsEditingAvatar] = useState(false);
  const [isDepositing, setIsDepositing] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);
  const [depositAmount, setDepositAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Yellow Network
  const [isDepositingYellow, setIsDepositingYellow] = useState(false);
  const [isWithdrawingYellow, setIsWithdrawingYellow] = useState(false);
  const [yellowDepositAmount, setYellowDepositAmount] = useState('');
  const [yellowWithdrawAmount, setYellowWithdrawAmount] = useState('');

  const balance = profile?.balance ?? 0;
  const initials = profile?.username?.slice(0, 2).toUpperCase() || user?.email?.slice(0, 2).toUpperCase() || 'W';

  // Get Yellow unified balance for ytest.usd
  const ytestBalance = unifiedBalance?.balances.find(b => b.asset === 'ytest.usd')?.amount || '0';

  const handleAvatarUpdate = async () => {
    if (!avatarUrl.trim() || !user) return;

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
    if (!user) {
      setError('Please log in to deposit tokens');
      return;
    }

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
    if (!user) {
      setError('Please log in to claim tokens');
      return;
    }

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

  /**
   * @deprecated
   */
  const handleYellowDeposit = async () => {
    if (!client) {
      setError('Yellow Network not connected');
      return;
    }

    const amount = parseFloat(yellowDepositAmount);
    if (isNaN(amount) || amount <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    // Convert to smallest unit (6 decimals for USDC)
    const amountInSmallestUnit = Math.floor(amount * 1_000_000).toString();

    setLoading(true);
    setError('');

    try {
      // await client.depositToUnifiedBalance('ytest.usd', amountInSmallestUnit);
      setYellowDepositAmount('');
      setIsDepositingYellow(false);
      await refreshBalance();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to deposit');
    } finally {
      setLoading(false);
    }
  };


  /**
   * @deprecated
   */
  const handleYellowWithdraw = async () => {
    if (!client || !address) {
      setError('Yellow Network not connected or wallet not connected');
      return;
    }

    const amount = parseFloat(yellowWithdrawAmount);
    if (isNaN(amount) || amount <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    // Convert to smallest unit (6 decimals for USDC)
    const amountInSmallestUnit = Math.floor(amount * 1_000_000).toString();

    setLoading(true);
    setError('');

    try {
      // await client.withdrawFromUnifiedBalance('ytest.usd', amountInSmallestUnit, address);
      setYellowWithdrawAmount('');
      setIsWithdrawingYellow(false);
      await refreshBalance();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to withdraw');
    } finally {
      setLoading(false);
    }
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
      {/* Show message when neither user nor wallet is connected */}
      {!user && !address && (
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader>
            <CardTitle className="text-white">Welcome to Profile</CardTitle>
            <CardDescription className="text-gray-400">
              Connect your wallet or log in to access your profile
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-row justify-center items-center gap-4">
            <WalletConnect />
            <span className="text-gray-400 text-sm">or</span>
            <Button
              className="bg-purple-600 hover:bg-purple-700 text-white"
              asChild
            >
              <Link href="/login">Log In</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Show wallet info when wallet is connected but user is not logged in */}
      {!user && address && (
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader>
            <CardTitle className="text-white">Wallet Connected</CardTitle>
            <CardDescription className="text-gray-400">
              Connected wallet: {address.slice(0, 6)}...{address.slice(-4)}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-gray-500 text-sm">
              Log in to access your full profile, transaction history, and token management features.
            </p>
          </CardContent>
        </Card>
      )}

      {/* User Profile Section - Only show if user is logged in */}
      {user && (
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
      )}

      {/* Wallet and Transaction sections - Only show if user is logged in */}
      {user && (
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
      )}

      {/* Yellow Network Unified Balance - Show when wallet is connected */}
      {address && (
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-600/20 rounded-lg">
                  <Network className="h-5 w-5 text-yellow-400" />
                </div>
                <div>
                  <CardTitle className="text-white text-lg">Yellow Network</CardTitle>
                  <CardDescription className="text-gray-400">
                    Unified Balance (Off-chain)
                  </CardDescription>
                </div>
              </div>
              <Badge
                variant="outline"
                className={
                  state.status === 'authenticated'
                    ? 'border-green-500 text-green-400 bg-green-500/10'
                    : 'border-gray-700 text-gray-400'
                }
              >
                {state.status.charAt(0).toUpperCase() + state.status.slice(1)}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2 mb-6">
              <span className="text-4xl font-bold text-white">
                {(parseInt(ytestBalance) / 1_000_000).toFixed(2)}
              </span>
              <span className="text-gray-400 text-lg">yUSD</span>
            </div>

            {state.status === 'authenticated' ? (
              <div className="flex gap-3">
                <Dialog open={isDepositingYellow} onOpenChange={setIsDepositingYellow}>
                  <DialogTrigger asChild>
                    <Button className="flex-1 bg-yellow-600 hover:bg-yellow-700">
                      <ArrowDownToLine className="h-4 w-4 mr-2" />
                      Deposit
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="bg-gray-900 border-gray-800">
                    <DialogHeader>
                      <DialogTitle className="text-white">Deposit to Yellow Network</DialogTitle>
                      <DialogDescription className="text-gray-400">
                        Transfer funds to your Unified Balance
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 pt-4">
                      <div className="space-y-2">
                        <Label htmlFor="yellow-deposit-amount" className="text-gray-300">
                          Amount (yUSD)
                        </Label>
                        <Input
                          id="yellow-deposit-amount"
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={yellowDepositAmount}
                          onChange={(e) => setYellowDepositAmount(e.target.value)}
                          placeholder="Enter amount"
                          className="bg-gray-800 border-gray-700 text-white"
                        />
                      </div>
                      <div className="flex gap-2">
                        {[10, 50, 100].map((amount) => (
                          <Button
                            key={amount}
                            variant="outline"
                            size="sm"
                            onClick={() => setYellowDepositAmount(amount.toString())}
                            className="flex-1 border-gray-700 text-gray-300 hover:bg-gray-800"
                          >
                            {amount}
                          </Button>
                        ))}
                      </div>
                      {error && <p className="text-red-400 text-sm">{error}</p>}
                      <Button
                        onClick={handleYellowDeposit}
                        disabled={loading || !yellowDepositAmount}
                        className="w-full bg-yellow-600 hover:bg-yellow-700"
                      >
                        {loading ? 'Processing...' : 'Deposit to Yellow'}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>

                <Dialog open={isWithdrawingYellow} onOpenChange={setIsWithdrawingYellow}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="flex-1 border-gray-700 hover:bg-gray-800">
                      <ArrowUpFromLine className="h-4 w-4 mr-2" />
                      Withdraw
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="bg-gray-900 border-gray-800">
                    <DialogHeader>
                      <DialogTitle className="text-white">Withdraw from Yellow Network</DialogTitle>
                      <DialogDescription className="text-gray-400">
                        Withdraw funds from Unified Balance to your wallet
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 pt-4">
                      <div className="space-y-2">
                        <Label htmlFor="yellow-withdraw-amount" className="text-gray-300">
                          Amount (yUSD)
                        </Label>
                        <Input
                          id="yellow-withdraw-amount"
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={yellowWithdrawAmount}
                          onChange={(e) => setYellowWithdrawAmount(e.target.value)}
                          placeholder="Enter amount"
                          className="bg-gray-800 border-gray-700 text-white"
                        />
                        <p className="text-xs text-gray-500">
                          Available: {(parseInt(ytestBalance) / 1_000_000).toFixed(2)} yUSD
                        </p>
                      </div>
                      <div className="flex gap-2">
                        {[10, 50, 100].map((amount) => (
                          <Button
                            key={amount}
                            variant="outline"
                            size="sm"
                            onClick={() => setYellowWithdrawAmount(amount.toString())}
                            className="flex-1 border-gray-700 text-gray-300 hover:bg-gray-800"
                            disabled={parseInt(ytestBalance) < amount * 1_000_000}
                          >
                            {amount}
                          </Button>
                        ))}
                      </div>
                      {error && <p className="text-red-400 text-sm">{error}</p>}
                      <Button
                        onClick={handleYellowWithdraw}
                        disabled={loading || !yellowWithdrawAmount || !address}
                        className="w-full bg-gray-700 hover:bg-gray-600"
                      >
                        {loading ? 'Processing...' : 'Withdraw to Wallet'}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            ) : address ? (
              <div className="space-y-4">
                <p className="text-sm text-gray-400 text-center">
                  {state.status === 'connected'
                    ? 'Connected to Yellow Network. Authenticate to access your Unified Balance.'
                    : 'Connect and authenticate with Yellow Network to manage your Unified Balance'}
                </p>
                <div className="flex gap-3">
                  {state.status === 'disconnected' && (
                    <Button
                      onClick={async () => {
                        try {
                          await connect();
                        } catch (error) {
                          console.error('Failed to connect:', error);
                        }
                      }}
                      disabled={isConnecting}
                      className="flex-1 bg-yellow-600 hover:bg-yellow-700"
                    >
                      {isConnecting ? 'Connecting...' : 'Connect to Yellow Network'}
                    </Button>
                  )}
                  {state.status === 'connected' && (
                    <Button
                      onClick={async () => {
                        try {
                          await authenticate();
                        } catch (error) {
                          console.error('Failed to authenticate:', error);
                        }
                      }}
                      disabled={isAuthenticating}
                      className="flex-1 bg-yellow-600 hover:bg-yellow-700"
                    >
                      {isAuthenticating ? 'Authenticating...' : 'Authenticate with Yellow Network'}
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-500 text-center py-2">
                Connect wallet to access Yellow Network features
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
