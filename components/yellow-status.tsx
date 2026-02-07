'use client';

/**
 * Yellow Network Status Component
 *
 * Shows connection status, balance, and authentication controls.
 */

import { useYellow, useYellowAuth, useYellowBalance } from '@/components/providers/yellow-provider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, WifiOff, Wifi, Shield, ShieldCheck } from 'lucide-react';
import { useAccount } from 'wagmi';

export function YellowStatus() {
  const { state, error, isAuthenticating } = useYellow();
  const { isAuthenticated, authenticate } = useYellowAuth();
  const { balance } = useYellowBalance();
  const { isConnected: isWalletConnected } = useAccount();

  const getStatusBadge = () => {
    switch (state.status) {
      case 'disconnected':
        return (
          <Badge variant="outline" className="gap-2">
            <WifiOff className="h-3 w-3" />
            Disconnected
          </Badge>
        );
      case 'connecting':
        return (
          <Badge variant="outline" className="gap-2">
            <Loader2 className="h-3 w-3 animate-spin" />
            Connecting...
          </Badge>
        );
      case 'connected':
        return (
          <Badge variant="outline" className="gap-2 bg-blue-500/10 text-blue-400 border-blue-500">
            <Wifi className="h-3 w-3" />
            Connected
          </Badge>
        );
      case 'authenticated':
        return (
          <Badge variant="outline" className="gap-2 bg-green-500/10 text-green-400 border-green-500">
            <ShieldCheck className="h-3 w-3" />
            Authenticated
          </Badge>
        );
      case 'error':
        return (
          <Badge variant="outline" className="gap-2 bg-red-500/10 text-red-400 border-red-500">
            <WifiOff className="h-3 w-3" />
            Error
          </Badge>
        );
      default:
        return null;
    }
  };

  const formatBalance = (amount: string, asset: string) => {
    const num = parseFloat(amount);
    if (isNaN(num)) return '0.00';

    // Assume 6 decimals for ytest.usd (USDC)
    const formatted = (num / 1000000).toFixed(2);
    return `${formatted} ${asset.toUpperCase()}`;
  };

  return (
    <Card className="bg-gray-900 border-gray-800">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg text-white">Yellow Network</CardTitle>
          {getStatusBadge()}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Connection Status */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-400">Status:</span>
            <span className="text-white font-medium capitalize">{state.status}</span>
          </div>

          {state.address && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-400">Address:</span>
              <span className="text-white font-mono text-xs">
                {state.address.slice(0, 6)}...{state.address.slice(-4)}
              </span>
            </div>
          )}

          {state.sessionKey && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-400">Session Key:</span>
              <span className="text-green-400 font-mono text-xs">
                {state.sessionKey.slice(0, 6)}...{state.sessionKey.slice(-4)}
              </span>
            </div>
          )}
        </div>

        {/* Unified Balance */}
        {isAuthenticated && balance && (
          <div className="space-y-2 pt-2 border-t border-gray-800">
            <div className="text-sm font-medium text-gray-400">Unified Balance:</div>
            {balance.balances.length > 0 ? (
              balance.balances.map((b) => (
                <div key={b.asset} className="flex items-center justify-between">
                  <span className="text-gray-400 text-sm">{b.asset.toUpperCase()}</span>
                  <span className="text-white font-medium">
                    {formatBalance(b.amount, b.asset)}
                  </span>
                </div>
              ))
            ) : (
              <div className="text-sm text-gray-500">No balances</div>
            )}
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg p-3">
            {error}
          </div>
        )}

        {/* Authentication Button */}
        {!isAuthenticated && state.status === 'connected' && (
          <div className="pt-2">
            <Button
              onClick={authenticate}
              disabled={!isWalletConnected || isAuthenticating}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white"
            >
              {isAuthenticating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Authenticating...
                </>
              ) : (
                <>
                  <Shield className="mr-2 h-4 w-4" />
                  Authenticate with Yellow
                </>
              )}
            </Button>
            {!isWalletConnected && (
              <p className="text-xs text-gray-500 mt-2 text-center">
                Connect your wallet first
              </p>
            )}
          </div>
        )}

        {/* Authenticated State */}
        {isAuthenticated && (
          <div className="pt-2">
            <div className="text-center text-sm text-green-400 flex items-center justify-center gap-2">
              <ShieldCheck className="h-4 w-4" />
              Ready to place bets!
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
