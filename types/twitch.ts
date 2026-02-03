export interface TwitchUser {
  id: string;
  login: string;
  display_name: string;
  type: string;
  broadcaster_type: string;
  description: string;
  profile_image_url: string;
  offline_image_url: string;
  view_count: number;
  created_at: string;
}

export interface TwitchStream {
  id: string;
  user_id: string;
  user_login: string;
  user_name: string;
  game_id: string;
  game_name: string;
  type: 'live' | '';
  title: string;
  viewer_count: number;
  started_at: string;
  language: string;
  thumbnail_url: string;
  tag_ids: string[];
  tags: string[];
  is_mature: boolean;
}

export interface TwitchChannel {
  broadcaster_id: string;
  broadcaster_login: string;
  broadcaster_name: string;
  broadcaster_language: string;
  game_id: string;
  game_name: string;
  title: string;
  delay: number;
  tags: string[];
}

export interface TwitchFollower {
  user_id: string;
  user_login: string;
  user_name: string;
  followed_at: string;
}

export interface TwitchPagination {
  cursor?: string;
}

export interface TwitchResponse<T> {
  data: T[];
  pagination?: TwitchPagination;
  total?: number;
}

export interface TwitchTokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}
