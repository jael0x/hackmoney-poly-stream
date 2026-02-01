/*
  # Add INSERT policy for markets table

  1. Security Changes
    - Add policy for authenticated users to create markets
    - This allows any authenticated user to insert new markets into the database
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'markets' 
    AND policyname = 'Authenticated users can create markets'
  ) THEN
    CREATE POLICY "Authenticated users can create markets"
      ON markets FOR INSERT
      TO authenticated
      WITH CHECK (true);
  END IF;
END $$;