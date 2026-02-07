# Guía de Migración - Yellow Network Fields

## Archivo Creado

✅ `supabase/migrations/20260206154039_add_yellow_network_fields.sql`

Esta migración agrega los campos necesarios para la integración de Yellow Network a la tabla `markets`.

---

## **Opción 1: Usando Supabase CLI (Recomendado)**

### Paso 1: Instalar Supabase CLI

```bash
# Ejecutar el script de instalación
chmod +x scripts/install-supabase-cli.sh
./scripts/install-supabase-cli.sh

# O instalar manualmente
npm install -g supabase
```

### Paso 2: Vincular tu proyecto

```bash
# Obtén tu PROJECT_REF del dashboard de Supabase
# URL: https://supabase.com/dashboard/project/[PROJECT_REF]

supabase link --project-ref hemrblmhvgzilttbodpp
```

Te pedirá tu **Database Password** (la que usaste al crear el proyecto).

### Paso 3: Ejecutar la migración

```bash
# Esto aplicará TODAS las migraciones pendientes
supabase db push
```

### Paso 4: Verificar

```bash
# Ver estado de migraciones
supabase migration list

# O verifica en el dashboard: Database > Migrations
```

---

## **Opción 2: Ejecutar Manualmente desde el Dashboard**

Si no quieres instalar la CLI o tienes problemas, puedes ejecutar la migración directamente:

### Paso 1: Ir al SQL Editor

1. Ve a https://supabase.com/dashboard/project/hemrblmhvgzilttbodpp
2. Click en **SQL Editor** en el menú lateral
3. Click en **+ New query**

### Paso 2: Copiar y Pegar el SQL

Copia todo el contenido del archivo:
```
supabase/migrations/20260206154039_add_yellow_network_fields.sql
```

O usa este SQL directamente:

```sql
-- Add Yellow Network fields to markets table
ALTER TABLE markets
ADD COLUMN IF NOT EXISTS app_session_id text,
ADD COLUMN IF NOT EXISTS pool_yes_address text,
ADD COLUMN IF NOT EXISTS pool_no_address text,
ADD COLUMN IF NOT EXISTS oracle_address text,
ADD COLUMN IF NOT EXISTS yes_amount text DEFAULT '0',
ADD COLUMN IF NOT EXISTS no_amount text DEFAULT '0',
ADD COLUMN IF NOT EXISTS twitch_metric text DEFAULT 'viewer_count',
ADD COLUMN IF NOT EXISTS target_value integer DEFAULT 10000,
ADD COLUMN IF NOT EXISTS winner text CHECK (winner IN ('yes', 'no'));

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_markets_app_session_id ON markets(app_session_id);
CREATE INDEX IF NOT EXISTS idx_markets_winner ON markets(winner);
CREATE INDEX IF NOT EXISTS idx_markets_twitch_metric ON markets(twitch_metric);

-- Add comments for documentation
COMMENT ON COLUMN markets.app_session_id IS 'Yellow Network app session ID for this prediction market';
COMMENT ON COLUMN markets.pool_yes_address IS 'Address of the YES betting pool participant';
COMMENT ON COLUMN markets.pool_no_address IS 'Address of the NO betting pool participant';
COMMENT ON COLUMN markets.oracle_address IS 'Address of the oracle that resolves the market';
COMMENT ON COLUMN markets.yes_amount IS 'Total amount staked on YES outcome (in smallest unit, e.g., 6 decimals for USDC)';
COMMENT ON COLUMN markets.no_amount IS 'Total amount staked on NO outcome (in smallest unit)';
COMMENT ON COLUMN markets.twitch_metric IS 'Twitch API metric to track (e.g., followers_count, viewer_count)';
COMMENT ON COLUMN markets.target_value IS 'Target value for the metric. If actual >= target, YES wins; otherwise NO wins';
COMMENT ON COLUMN markets.winner IS 'Winner of the market after resolution (yes or no)';
```

### Paso 3: Ejecutar

1. Click en **Run** (botón verde)
2. Verifica que diga "Success. No rows returned"

### Paso 4: Verificar las Columnas

Ejecuta esta query para verificar:

```sql
SELECT
  column_name,
  data_type,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'markets'
ORDER BY ordinal_position;
```

Deberías ver todas las nuevas columnas listadas.

---

## **Siguiente Paso: Actualizar TypeScript Types**

Después de ejecutar la migración, necesitas actualizar los tipos de TypeScript:

### Opción A: Regenerar automáticamente (con Supabase CLI)

```bash
supabase gen types typescript --local > types/database.ts
```

### Opción B: Actualizar manualmente

Edita `types/database.ts` y agrega los nuevos campos a la interfaz `markets`:

```typescript
markets: {
  Row: {
    // ... campos existentes
    app_session_id: string | null;
    pool_yes_address: string | null;
    pool_no_address: string | null;
    oracle_address: string | null;
    yes_amount: string;
    no_amount: string;
    twitch_metric: string;
    target_value: number;
    winner: 'yes' | 'no' | null;
  };
  Insert: {
    // ... campos existentes
    app_session_id?: string | null;
    pool_yes_address?: string | null;
    pool_no_address?: string | null;
    oracle_address?: string | null;
    yes_amount?: string;
    no_amount?: string;
    twitch_metric?: string;
    target_value?: number;
    winner?: 'yes' | 'no' | null;
  };
  Update: {
    // ... campos existentes
    app_session_id?: string | null;
    pool_yes_address?: string | null;
    pool_no_address?: string | null;
    oracle_address?: string | null;
    yes_amount?: string;
    no_amount?: string;
    twitch_metric?: string;
    target_value?: number;
    winner?: 'yes' | 'no' | null;
  };
}
```

---

## Campos Agregados

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `app_session_id` | text | ID del App Session de Yellow Network |
| `pool_yes_address` | text | Dirección del pool de apuestas YES |
| `pool_no_address` | text | Dirección del pool de apuestas NO |
| `oracle_address` | text | Dirección del oráculo que resuelve el mercado |
| `yes_amount` | text | Cantidad total apostada en YES (unidad mínima) |
| `no_amount` | text | Cantidad total apostada en NO (unidad mínima) |
| `twitch_metric` | text | Métrica de Twitch a rastrear |
| `target_value` | integer | Valor objetivo para determinar ganador |
| `winner` | text | Resultado del mercado ('yes' o 'no') |

---

## Verificación Post-Migración

Ejecuta esta query para verificar que todo funciona:

```sql
-- Insertar un mercado de prueba con los nuevos campos
INSERT INTO markets (
  question,
  description,
  twitch_metric,
  target_value,
  yes_price,
  no_price
) VALUES (
  'Test market with Yellow Network fields',
  'Testing the new migration',
  'viewer_count',
  5000,
  50.00,
  50.00
) RETURNING *;

-- Ver todos los mercados con los nuevos campos
SELECT
  id,
  question,
  app_session_id,
  yes_amount,
  no_amount,
  twitch_metric,
  target_value,
  winner
FROM markets
LIMIT 5;
```

---

## Troubleshooting

### Error: "column already exists"

Si ya ejecutaste partes de la migración manualmente, puedes saltarte campos específicos o hacer:

```sql
-- Verificar qué columnas ya existen
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'markets'
  AND column_name IN (
    'app_session_id',
    'pool_yes_address',
    'yes_amount'
  );
```

### Error: "permission denied"

Asegúrate de estar usando las credenciales correctas:
- Para CLI: Database password del proyecto
- Para Dashboard: Tu cuenta de Supabase con permisos de Admin

---

## ¿Qué Hacer Después?

1. ✅ Ejecutar la migración (elegir Opción 1 o 2)
2. ✅ Actualizar `types/database.ts`
3. ⏭️ Verificar que el build de TypeScript pase
4. ⏭️ Configurar variables de entorno del oráculo
5. ⏭️ Implementar la creación de App Sessions en la creación de mercados

Ver `YELLOW_NETWORK_INTEGRATION.md` para los siguientes pasos.
