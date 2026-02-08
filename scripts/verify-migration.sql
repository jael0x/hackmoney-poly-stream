-- Script para verificar si la migración de Yellow Network se aplicó correctamente

-- 1. Verificar que las columnas existen
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'markets'
  AND column_name IN (
    'app_session_id',
    'pool_yes_address',
    'pool_no_address',
    'oracle_address',
    'yes_amount',
    'no_amount',
    'twitch_metric',
    'target_value',
    'winner'
  )
ORDER BY column_name;

-- RESULTADO ESPERADO: 9 filas (una por cada columna nueva)

-- 2. Verificar que los índices existen
SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'markets'
  AND indexname IN (
    'idx_markets_app_session_id',
    'idx_markets_winner',
    'idx_markets_twitch_metric'
  );

-- RESULTADO ESPERADO: 3 filas (una por cada índice)

-- 3. Verificar el constraint del campo winner
SELECT
  con.conname AS constraint_name,
  con.contype AS constraint_type,
  pg_get_constraintdef(con.oid) AS constraint_definition
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.conrelid
WHERE rel.relname = 'markets'
  AND pg_get_constraintdef(con.oid) LIKE '%winner%';

-- RESULTADO ESPERADO: 1 fila mostrando el CHECK constraint

-- 4. Ver todos los campos de la tabla markets (opcional)
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'markets'
ORDER BY ordinal_position;
