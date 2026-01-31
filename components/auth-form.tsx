'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Gamepad2 } from 'lucide-react';
import Link from 'next/link';
import type { Database } from '@/types/database';

interface AuthFormProps {
  mode: 'login' | 'signup';
}

export function AuthForm({ mode }: AuthFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        });

        if (error) throw error;

        if (data.user) {
          const { error: profileError } = await supabase
            .from('profiles')
            .insert({
              id: data.user.id,
              username: username || email.split('@')[0],
            } as any);

          if (profileError) {
            console.error('Profile creation error:', profileError);
          }
        }

        router.push('/');
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;
        router.push('/');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-4">
            <Gamepad2 className="h-10 w-10 text-purple-500" />
            <span className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent">
              StreamBet
            </span>
          </Link>
          <h2 className="text-2xl font-bold text-white mt-4">
            {mode === 'login' ? 'Welcome back' : 'Create your account'}
          </h2>
          <p className="text-gray-400 mt-2">
            {mode === 'login'
              ? 'Sign in to start predicting streamer events'
              : 'Join the ultimate streamer prediction market'}
          </p>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-lg p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {mode === 'signup' && (
              <div className="space-y-2">
                <Label htmlFor="username" className="text-gray-300">
                  Username
                </Label>
                <Input
                  id="username"
                  type="text"
                  placeholder="gamer123"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="bg-gray-950 border-gray-800 text-white focus:border-purple-500"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email" className="text-gray-300">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-gray-950 border-gray-800 text-white focus:border-purple-500"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-gray-300">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="bg-gray-950 border-gray-800 text-white focus:border-purple-500"
              />
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button
              type="submit"
              className="w-full bg-purple-600 hover:bg-purple-700 text-white"
              disabled={loading}
            >
              {loading
                ? 'Loading...'
                : mode === 'login'
                ? 'Sign In'
                : 'Create Account'}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-gray-400 text-sm">
              {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}{' '}
              <Link
                href={mode === 'login' ? '/signup' : '/login'}
                className="text-purple-400 hover:text-purple-300 font-medium"
              >
                {mode === 'login' ? 'Sign up' : 'Log in'}
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
