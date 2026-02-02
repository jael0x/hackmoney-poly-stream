export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          username: string | null;
          avatar_url: string | null;
          balance: number | null;
          created_at: string;
        };
        Insert: {
          id: string;
          username?: string | null;
          avatar_url?: string | null;
          balance?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          username?: string | null;
          avatar_url?: string | null;
          balance?: number | null;
          created_at?: string;
        };
        Relationships: [];
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
        Relationships: [];
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
          status: string;
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
          status?: string;
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
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "markets_streamer_id_fkey";
            columns: ["streamer_id"];
            isOneToOne: false;
            referencedRelation: "streamers";
            referencedColumns: ["id"];
          }
        ];
      };
      transactions: {
        Row: {
          id: string;
          user_id: string;
          type: string;
          amount: number;
          description: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          type: string;
          amount: number;
          description?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          type?: string;
          amount?: number;
          description?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "transactions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
