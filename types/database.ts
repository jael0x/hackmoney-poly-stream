export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          username: string | null;
          avatar_url: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          username?: string | null;
          avatar_url?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          username?: string | null;
          avatar_url?: string | null;
          created_at?: string;
        };
      };
      streamers: {
        Row: {
          id: string;
          name: string;
          slug: string;
          description: string | null;
          profile_image_url: string | null;
          banner_image_url: string | null;
          platform: string;
          is_live: boolean;
          followers_count: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          description?: string | null;
          profile_image_url?: string | null;
          banner_image_url?: string | null;
          platform?: string;
          is_live?: boolean;
          followers_count?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          description?: string | null;
          profile_image_url?: string | null;
          banner_image_url?: string | null;
          platform?: string;
          is_live?: boolean;
          followers_count?: number;
          created_at?: string;
        };
      };
      markets: {
        Row: {
          id: string;
          streamer_id: string | null;
          question: string;
          description: string | null;
          yes_price: number;
          no_price: number;
          volume: number;
          end_date: string | null;
          status: 'active' | 'closed' | 'resolved';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          streamer_id?: string | null;
          question: string;
          description?: string | null;
          yes_price?: number;
          no_price?: number;
          volume?: number;
          end_date?: string | null;
          status?: 'active' | 'closed' | 'resolved';
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          streamer_id?: string | null;
          question?: string;
          description?: string | null;
          yes_price?: number;
          no_price?: number;
          volume?: number;
          end_date?: string | null;
          status?: 'active' | 'closed' | 'resolved';
          created_at?: string;
          updated_at?: string;
        };
      };
    };
  };
};
