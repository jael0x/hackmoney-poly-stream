import type {
  TwitchUser,
  TwitchStream,
  TwitchChannel,
  TwitchFollower,
  TwitchResponse,
  TwitchTokenResponse,
} from '@/types/twitch';

const TWITCH_API_URL = 'https://api.twitch.tv/helix';
const TWITCH_AUTH_URL = 'https://id.twitch.tv/oauth2';

let cachedToken: { token: string; expiresAt: number } | null = null;

export async function getAppAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.token;
  }

  const clientId = process.env.NEXT_PUBLIC_TWITCH_CLIENT_ID;
  const clientSecret = process.env.TWITCH_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('Twitch credentials not configured');
  }

  const response = await fetch(`${TWITCH_AUTH_URL}/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'client_credentials',
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to get Twitch access token');
  }

  const data: TwitchTokenResponse = await response.json();

  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  };

  return data.access_token;
}

async function twitchFetch<T>(
  endpoint: string,
  params?: Record<string, string>
): Promise<TwitchResponse<T>> {
  const token = await getAppAccessToken();
  const clientId = process.env.NEXT_PUBLIC_TWITCH_CLIENT_ID!;

  const url = new URL(`${TWITCH_API_URL}${endpoint}`);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });
  }

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
      'Client-Id': clientId,
    },
  });

  if (!response.ok) {
    throw new Error(`Twitch API error: ${response.status}`);
  }

  return response.json();
}

export async function getUsers(
  logins?: string[],
  ids?: string[]
): Promise<TwitchUser[]> {
  const params: Record<string, string> = {};

  if (logins?.length) {
    logins.forEach((login, i) => {
      params[`login`] = login;
    });
  }

  if (ids?.length) {
    ids.forEach((id, i) => {
      params[`id`] = id;
    });
  }

  const response = await twitchFetch<TwitchUser>('/users', params);
  return response.data;
}

export async function getUserByLogin(login: string): Promise<TwitchUser | null> {
  const users = await getUsers([login]);
  return users[0] || null;
}

export async function getStreams(params?: {
  user_id?: string;
  user_login?: string;
  game_id?: string;
  language?: string;
  first?: number;
}): Promise<TwitchResponse<TwitchStream>> {
  const queryParams: Record<string, string> = {};

  if (params?.user_id) queryParams.user_id = params.user_id;
  if (params?.user_login) queryParams.user_login = params.user_login;
  if (params?.game_id) queryParams.game_id = params.game_id;
  if (params?.language) queryParams.language = params.language;
  if (params?.first) queryParams.first = params.first.toString();

  return twitchFetch<TwitchStream>('/streams', queryParams);
}

export async function getLiveStreams(first: number = 20): Promise<TwitchStream[]> {
  const response = await getStreams({ first });
  return response.data;
}

export async function getStreamByUser(userLogin: string): Promise<TwitchStream | null> {
  const response = await getStreams({ user_login: userLogin, first: 1 });
  return response.data[0] || null;
}

export async function getChannel(broadcasterId: string): Promise<TwitchChannel | null> {
  const response = await twitchFetch<TwitchChannel>('/channels', {
    broadcaster_id: broadcasterId,
  });
  return response.data[0] || null;
}

export async function getFollowerCount(broadcasterId: string): Promise<number> {
  const response = await twitchFetch<TwitchFollower>('/channels/followers', {
    broadcaster_id: broadcasterId,
    first: '1',
  });
  return response.total || 0;
}

export async function searchChannels(
  query: string,
  first: number = 20
): Promise<TwitchResponse<TwitchChannel>> {
  return twitchFetch<TwitchChannel>('/search/channels', {
    query,
    first: first.toString(),
  });
}

export function getThumbnailUrl(
  thumbnailUrl: string,
  width: number = 320,
  height: number = 180
): string {
  return thumbnailUrl
    .replace('{width}', width.toString())
    .replace('{height}', height.toString());
}
