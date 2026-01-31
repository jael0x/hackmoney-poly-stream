/*
  # Initial Schema for Streamer Prediction Market

  1. New Tables
    - `profiles`
      - `id` (uuid, references auth.users, primary key)
      - `username` (text, unique)
      - `avatar_url` (text)
      - `created_at` (timestamptz)
    
    - `streamers`
      - `id` (uuid, primary key)
      - `name` (text)
      - `slug` (text, unique)
      - `description` (text)
      - `profile_image_url` (text)
      - `banner_image_url` (text)
      - `platform` (text, e.g., 'twitch', 'youtube')
      - `is_live` (boolean)
      - `followers_count` (integer)
      - `created_at` (timestamptz)
    
    - `markets`
      - `id` (uuid, primary key)
      - `streamer_id` (uuid, references streamers)
      - `question` (text)
      - `description` (text)
      - `yes_price` (numeric, 0-100 representing percentage)
      - `no_price` (numeric, 0-100 representing percentage)
      - `volume` (numeric)
      - `end_date` (timestamptz)
      - `status` (text: 'active', 'closed', 'resolved')
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users
*/

-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  username text UNIQUE,
  avatar_url text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Create streamers table
CREATE TABLE IF NOT EXISTS streamers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  description text,
  profile_image_url text,
  banner_image_url text,
  platform text DEFAULT 'twitch',
  is_live boolean DEFAULT false,
  followers_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE streamers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view streamers"
  ON streamers FOR SELECT
  TO authenticated
  USING (true);

-- Create markets table
CREATE TABLE IF NOT EXISTS markets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  streamer_id uuid REFERENCES streamers(id) ON DELETE CASCADE,
  question text NOT NULL,
  description text,
  yes_price numeric(5,2) DEFAULT 50.00 CHECK (yes_price >= 0 AND yes_price <= 100),
  no_price numeric(5,2) DEFAULT 50.00 CHECK (no_price >= 0 AND no_price <= 100),
  volume numeric DEFAULT 0,
  end_date timestamptz,
  status text DEFAULT 'active' CHECK (status IN ('active', 'closed', 'resolved')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE markets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active markets"
  ON markets FOR SELECT
  TO authenticated
  USING (true);

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_markets_streamer_id ON markets(streamer_id);
CREATE INDEX IF NOT EXISTS idx_markets_status ON markets(status);
CREATE INDEX IF NOT EXISTS idx_streamers_slug ON streamers(slug);