import { useState, useEffect, useCallback } from 'react';
import type { TwitchStream, TwitchUser, TwitchChannel } from '@/types/twitch';

interface UseTwitchStreamsResult {
  streams: TwitchStream[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useTwitchStreams(first: number = 20): UseTwitchStreamsResult {
  const [streams, setStreams] = useState<TwitchStream[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStreams = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/twitch/streams?first=${first}`);
      if (!response.ok) throw new Error('Failed to fetch streams');
      const data = await response.json();
      setStreams(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [first]);

  useEffect(() => {
    fetchStreams();
  }, [fetchStreams]);

  return { streams, loading, error, refetch: fetchStreams };
}

interface UseTwitchUserResult {
  user: (TwitchUser & { follower_count: number }) | null;
  loading: boolean;
  error: string | null;
}

export function useTwitchUser(login: string | null): UseTwitchUserResult {
  const [user, setUser] = useState<(TwitchUser & { follower_count: number }) | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!login) {
      setUser(null);
      return;
    }

    const fetchUser = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/twitch/users?login=${login}`);
        if (!response.ok) throw new Error('Failed to fetch user');
        const data = await response.json();
        setUser(data.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, [login]);

  return { user, loading, error };
}

interface UseStreamStatusResult {
  isLive: boolean;
  stream: TwitchStream | null;
  loading: boolean;
  error: string | null;
}

export function useStreamStatus(userLogin: string | null): UseStreamStatusResult {
  const [stream, setStream] = useState<TwitchStream | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userLogin) {
      setStream(null);
      return;
    }

    const fetchStatus = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/twitch/streams?user_login=${userLogin}`);
        if (!response.ok) throw new Error('Failed to fetch stream status');
        const data = await response.json();
        setStream(data.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 60000);
    return () => clearInterval(interval);
  }, [userLogin]);

  return { isLive: !!stream, stream, loading, error };
}

interface UseTwitchSearchResult {
  results: TwitchChannel[];
  loading: boolean;
  error: string | null;
  search: (query: string) => Promise<void>;
}

export function useTwitchSearch(): UseTwitchSearchResult {
  const [results, setResults] = useState<TwitchChannel[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = useCallback(async (query: string) => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/twitch/search?q=${encodeURIComponent(query)}`);
      if (!response.ok) throw new Error('Failed to search');
      const data = await response.json();
      setResults(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  return { results, loading, error, search };
}
