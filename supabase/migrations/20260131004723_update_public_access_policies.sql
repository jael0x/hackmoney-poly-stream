/*
  # Update RLS Policies for Public Access

  1. Changes
    - Drop existing restrictive policies on streamers and markets
    - Add new policies that allow public read access
    - Keep write access restricted
  
  2. Security
    - Streamers and markets are public data (anyone can view)
    - Only authenticated users can modify data
    - Profiles remain private (only owners can view/edit)
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Anyone can view streamers" ON streamers;
DROP POLICY IF EXISTS "Anyone can view active markets" ON markets;

-- Create new public read policies
CREATE POLICY "Public can view all streamers"
  ON streamers FOR SELECT
  USING (true);

CREATE POLICY "Public can view all markets"
  ON markets FOR SELECT
  USING (true);