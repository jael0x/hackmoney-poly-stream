/*
  # Add Wallet and Transactions Support

  1. Changes to `profiles` table
    - Add `balance` column (numeric) - User's token balance, defaults to 0
    
  2. New Tables
    - `transactions`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references profiles)
      - `type` (text) - 'deposit', 'withdrawal', 'claim', 'bet', 'win'
      - `amount` (numeric) - Transaction amount
      - `description` (text) - Optional description
      - `created_at` (timestamptz)
      
  3. Security
    - Enable RLS on `transactions` table
    - Users can only view their own transactions
    - Users can only insert their own transactions
*/

-- Add balance column to profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'balance'
  ) THEN
    ALTER TABLE profiles ADD COLUMN balance numeric DEFAULT 0;
  END IF;
END $$;

-- Create transactions table
CREATE TABLE IF NOT EXISTS transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('deposit', 'withdrawal', 'claim', 'bet', 'win')),
  amount numeric NOT NULL,
  description text,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on transactions
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own transactions
CREATE POLICY "Users can view own transactions"
  ON transactions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Policy: Users can insert their own transactions
CREATE POLICY "Users can insert own transactions"
  ON transactions
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at DESC);