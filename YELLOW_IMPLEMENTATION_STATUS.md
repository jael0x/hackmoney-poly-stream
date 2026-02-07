# Yellow Network Integration - Estado de Implementación

## 📋 Resumen

Integración completa de Yellow Network State Channels en la plataforma de predicción de mercados basados en Twitch. El sistema permite crear mercados automáticamente, apostar con state channels, y resolver mediante un oráculo basado en la API de Twitch.

---

## ✅ Implementado - Flujo Completo

### 1. **Creación Automática de Mercados**

#### Archivo: `app/api/markets/auto-create/route.ts`

**Flujo:**
1. Escanea streams en vivo usando Twitch API (`getLiveStreams()`)
2. Para cada streamer en vivo:
   - Verifica que exista en la base de datos
   - Verifica que no tenga mercados activos
   - Obtiene métricas actuales (viewers, followers)
3. Genera mercados usando templates:
   - **Viewer Count**: Target = 2x viewers actuales (mín 1000)
   - **Follower Count**: Target = followers actuales + 5% o +500
4. Crea Yellow Network App Session con 3 participantes:
   - Pool YES
   - Pool NO
   - Oracle
5. Guarda market en database con todos los campos de Yellow Network

**Ejemplo de mercado auto-generado:**
```
Pregunta: "¿Alcanzará TheBurntPeanut 10,000 viewers en este stream?"
Métrica: viewer_count
Target: 10000
Duración: 6 horas
App Session ID: 0x1234...
```

---

### 2. **Creación Manual de Mercados**

#### Archivos:
- `components/create-market-form.tsx`
- `app/api/markets/create/route.ts`

**Flujo:**
1. Usuario completa formulario:
   - Selecciona streamer
   - Escribe pregunta personalizada
   - Selecciona métrica de Twitch (viewers/followers)
   - Define valor objetivo (target value)
   - Selecciona fecha de resolución
2. Form valida datos con Zod schema
3. Envía a API `/api/markets/create`
4. API crea Yellow Network App Session
5. Guarda market en database
6. Redirige a página del streamer

**Campos nuevos agregados:**
- `twitchMetric`: 'viewer_count' | 'followers_count'
- `targetValue`: number (ej: 50000)

---

### 3. **Sistema de Apuestas con Yellow Network**

#### Archivos:
- `components/bet-button.tsx`
- `app/api/markets/bet/route.ts`

**Flujo de Apuesta:**
1. Usuario hace click en "Buy YES" o "Buy NO"
2. Se abre dialog de apuesta:
   - Muestra precio actual
   - Input para monto en USDC
   - Calcula retorno potencial
3. Si no está conectado → Conecta wallet Yellow
4. Usuario confirma apuesta
5. API procesa:
   - Valida market está activo
   - Inicializa Yellow Client con wallet del usuario
   - Ejecuta `yellowClient.submitBet()` con DEPOSIT intent
   - Actualiza amounts en database (yes_amount, no_amount)
   - Recalcula precios usando fórmula AMM simple:
     ```
     yesPrice = (yes_amount / total_volume) * 100
     noPrice = 100 - yesPrice
     ```
6. Refresca página para mostrar nuevos precios

**Integración Yellow Network:**
```typescript
await yellowClient.submitBet(
  appSessionId,    // ID del App Session
  poolAddress,     // pool_yes_address o pool_no_address
  amount          // Cantidad en USDC
);
```

---

### 4. **Resolución Automática por Oráculo**

#### Archivo: `lib/yellow/oracle.ts`

**Flujo del Oracle:**
1. **Cierre de Mercados Expirados** (`closeExpiredMarkets()`):
   - Busca markets con `status='active'` y `end_date <= now`
   - Cambia status a 'closed'

2. **Resolución de Mercados** (`resolveMarket()`):
   - Busca markets con `status='closed'`
   - Para cada market:
     - Obtiene métrica actual de Twitch API
     - Compara con target_value:
       ```
       winner = actualValue >= targetValue ? 'yes' : 'no'
       ```
     - Guarda resultado en database

3. **Distribución de Fondos** (`distributeWinnings()`):
   - Calcula allocations finales:
     - Si YES gana: todo el pool va a pool_yes_address
     - Si NO gana: todo el pool va a pool_no_address
     - Oracle recibe 0
   - Cierra Yellow App Session con `closeAppSession()`

**Endpoint:** `GET/POST /api/oracle/run`

**Ejecución:**
```bash
# Manual
curl http://localhost:3001/api/oracle/run

# Automatizar con cron (Vercel)
# vercel.json
{
  "crons": [{
    "path": "/api/oracle/run",
    "schedule": "*/5 * * * *"  // Cada 5 minutos
  }]
}
```

---

### 5. **Sistema de Reclamo de Ganancias**

#### Archivos:
- `components/claim-winnings-button.tsx`
- `app/api/markets/claim/route.ts`

**Flujo de Claim:**
1. Market se resuelve (status='resolved', winner='yes'|'no')
2. En MarketCard aparece:
   ```
   Market Resolved: YES wins!
   [Claim Winnings]
   ```
3. Usuario hace click en "Claim Winnings"
4. API calcula share del usuario:
   ```typescript
   userShare = (userBet / totalWinningPool) * totalPot
   ```
5. En implementación completa:
   - Retiraría fondos del App Session
   - Transferiría a wallet del usuario
   - Marcaría como claimed en database

**Estado actual:** Calcula y muestra winnings (modo demo)

---

### 6. **UI Actualizada - Market Cards**

#### Archivo: `components/market-card.tsx`

**Cambios visuales:**

1. **Badges de Yellow Network:**
   ```jsx
   <Badge>⚡ Yellow Network</Badge>
   <Badge>🎯 Viewers: 50,000</Badge>
   ```

2. **Estados del Market:**
   - **Activo**: Muestra botones "Buy YES" / "Buy NO"
   - **Resuelto**: Muestra ganador y botón "Claim Winnings"

3. **BetButton integrado:**
   - Reemplaza botones simples
   - Abre dialog con Yellow wallet connect
   - Procesa apuestas con state channels

---

## 🔧 Configuración Necesaria

### Variables de Entorno

```env
# Twitch API
NEXT_PUBLIC_TWITCH_CLIENT_ID=tu_client_id
TWITCH_CLIENT_SECRET=tu_client_secret

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...

# Yellow Network
YELLOW_ORACLE_PRIVATE_KEY=0x...  # Private key del wallet del oráculo
YELLOW_USER_PRIVATE_KEY=0x...    # Para testing (producción usa wallet connect)
```

### Base de Datos

**Migración aplicada:** `20260206154039_add_yellow_network_fields.sql`

**Campos nuevos en tabla `markets`:**
- `app_session_id` (text) - ID del App Session de Yellow
- `pool_yes_address` (text) - Address del pool de YES
- `pool_no_address` (text) - Address del pool de NO
- `oracle_address` (text) - Address del oráculo
- `yes_amount` (text) - Total apostado en YES (string para BigInt)
- `no_amount` (text) - Total apostado en NO
- `twitch_metric` (text) - 'viewer_count' | 'followers_count'
- `target_value` (integer) - Valor objetivo para determinar ganador
- `winner` (text) - 'yes' | 'no' | null

---

## ⏳ Pendientes por Implementar

### 1. **Wallet Connect Real** (CRÍTICO)
**Problema actual:** Usa `YELLOW_USER_PRIVATE_KEY` del .env
**Necesario:** Integrar wallet connect para que usuarios usen sus propias wallets

**Archivos a modificar:**
- `components/providers/yellow-provider.tsx`
- `components/bet-button.tsx`

**Solución:**
```typescript
// Usar WalletConnect o similar
import { useWalletConnect } from '@walletconnect/...';

const { connect, address, signMessage } = useWalletConnect();

// En lugar de usar env variable:
const yellowClient = new YellowClient(userPrivateKey);
// Usar wallet conectada
```

---

### 2. **Tabla de Bets en Base de Datos**
**Problema actual:** No se guarda quién apostó qué
**Necesario:** Tabla `bets` para tracking de apuestas por usuario

**Schema propuesto:**
```sql
CREATE TABLE bets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  market_id uuid REFERENCES markets(id),
  user_address text NOT NULL,
  position text CHECK (position IN ('yes', 'no')),
  amount text NOT NULL,  -- BigInt en string
  price_at_time numeric,
  created_at timestamp DEFAULT now(),
  claimed boolean DEFAULT false
);

CREATE INDEX idx_bets_market_id ON bets(market_id);
CREATE INDEX idx_bets_user_address ON bets(user_address);
```

**Modificar:**
- `app/api/markets/bet/route.ts` - Guardar bet en DB
- `app/api/markets/claim/route.ts` - Buscar bets del usuario

---

### 3. **Retiro Real de Fondos en Claim**
**Problema actual:** Solo calcula, no retira
**Necesario:** Implementar withdrawal de Yellow App Session

**Implementación:**
```typescript
// En app/api/markets/claim/route.ts
const yellowClient = new YellowClient(oraclePrivateKey);

// Withdraw del pool ganador al usuario
await yellowClient.withdraw({
  appSessionId: market.app_session_id,
  from: winningPoolAddress,
  to: userAddress,
  amount: userWinnings,
});
```

---

### 4. **Manejo de Errores y Validaciones**
**Pendiente:**
- ✅ Validar saldos antes de apostar
- ✅ Manejar transacciones fallidas de Yellow Network
- ✅ Retry logic para oracle
- ✅ Validar que market no esté ya resuelto
- ✅ Prevenir double-claiming

---

### 5. **Optimización de Precios (AMM)**
**Actual:** Fórmula simple `price = amount / total * 100`
**Mejorar:** Implementar AMM más sofisticado (ej: CPMM como Uniswap)

**Fórmula CPMM:**
```typescript
// Constant Product Market Maker
const k = yesAmount * noAmount;

function getPrice(buyAmount: bigint, isYes: boolean) {
  const newYes = isYes ? yesAmount + buyAmount : yesAmount;
  const newNo = isYes ? noAmount : noAmount + buyAmount;

  // Mantener k constante
  const requiredAmount = k / (isYes ? newNo : newYes);
  return requiredAmount;
}
```

---

### 6. **UI/UX Mejoras**
**Pendiente:**
- Loading states durante transacciones Yellow
- Toast notifications en lugar de alerts
- Historial de apuestas del usuario
- Gráfica de probabilidad en tiempo real
- Confirmación visual de transacciones exitosas

---

### 7. **Seguridad**
**Pendiente:**
- Rate limiting en APIs
- Validación de signatures en transacciones
- Protección contra front-running
- Audit de smart contracts (si se usan)

---

## 🧪 Pendientes por Probar

### Pruebas Unitarias
```bash
# Crear tests para:
- [ ] YellowClient.createAppSession()
- [ ] YellowClient.submitBet()
- [ ] YellowClient.closeAppSession()
- [ ] TwitchOracle.resolveMarket()
- [ ] TwitchOracle.distributeWinnings()
```

### Pruebas de Integración

#### 1. **Flujo Completo de Creación Manual**
```bash
# Paso 1: Crear market manualmente
curl -X POST http://localhost:3001/api/markets/create \
  -H "Content-Type: application/json" \
  -d '{
    "streamerId": "uuid-del-streamer",
    "question": "¿Alcanzará 50k viewers?",
    "twitchMetric": "viewer_count",
    "targetValue": 50000,
    "endDate": "2026-02-07T12:00:00Z"
  }'

# Verificar:
- ✅ Market creado en DB
- ✅ app_session_id no es null
- ✅ Pools creados con addresses
```

#### 2. **Flujo de Auto-Creación**
```bash
# Ejecutar auto-create
curl -X POST http://localhost:3001/api/markets/auto-create

# Verificar:
- ✅ Markets creados para streams en vivo
- ✅ Targets calculados correctamente
- ✅ No duplica markets para mismo streamer
- ✅ Todos tienen App Session ID
```

#### 3. **Flujo de Apuestas**
```bash
# Test en browser:
1. Ir a http://localhost:3001
2. Encontrar market activo
3. Click "Buy YES"
4. Ingresar monto: 10 USDC
5. Confirmar

# Verificar:
- ✅ Dialog se abre
- ✅ Wallet connect funciona
- ✅ Transacción Yellow exitosa
- ✅ Precios actualizados en UI
- ✅ yes_amount aumentó en DB
```

#### 4. **Flujo de Oracle**
```bash
# Simular resolución:

# Paso 1: Cerrar market manualmente
UPDATE markets
SET end_date = NOW() - INTERVAL '1 hour'
WHERE id = 'market-id';

# Paso 2: Ejecutar oracle
curl http://localhost:3001/api/oracle/run

# Verificar:
- ✅ Market cerrado (status='closed')
- ✅ Market resuelto con winner
- ✅ App Session cerrado en Yellow
```

#### 5. **Flujo de Claim**
```bash
# Test después de resolver:
1. Ir a market resuelto
2. Click "Claim Winnings"

# Verificar:
- ✅ Botón solo aparece en resolved markets
- ✅ Calcula winnings correctamente
- ✅ Muestra mensaje de éxito
```

### Pruebas de Borde (Edge Cases)

```bash
# Test casos límite:
- [ ] Apostar con saldo insuficiente
- [ ] Apostar en market ya cerrado
- [ ] Resolver market sin App Session
- [ ] Claim en market no ganado
- [ ] Double claim
- [ ] Market sin streamers en la query
- [ ] Oracle corre con markets vacíos
```

### Pruebas de Performance

```bash
# Medir tiempos:
- [ ] Creación de App Session (objetivo: <2s)
- [ ] Submit bet (objetivo: <1s)
- [ ] Oracle resolution (objetivo: <5s por market)
- [ ] Auto-create con 10+ streams (objetivo: <30s)
```

### Pruebas de Yellow Network

```bash
# Verificar integración:
- [ ] App Sessions se crean en Yellow testnet
- [ ] Deposits aparecen en Yellow explorer
- [ ] Close session distribuye fondos correctamente
- [ ] Estado del channel actualiza en tiempo real
```

---

## 📝 Checklist de Testing

### Pre-Deploy a Producción
- [ ] Migración de DB aplicada en production
- [ ] Variables de entorno configuradas
- [ ] Oracle wallet fondeado con gas
- [ ] Wallet connect configurado (no usar private keys en env)
- [ ] Tabla `bets` creada
- [ ] Cron job configurado para oracle
- [ ] Rate limiting activado
- [ ] Logs de errores configurados (Sentry, LogRocket, etc.)

### Testing Manual Completo
- [ ] Crear market manual con cada tipo de métrica
- [ ] Crear market automático
- [ ] Apostar en YES
- [ ] Apostar en NO
- [ ] Ver actualización de precios
- [ ] Esperar resolución automática
- [ ] Reclamar winnings
- [ ] Verificar fondos en wallet

### Monitoreo Post-Deploy
- [ ] Dashboard de Yellow Network funcionando
- [ ] Oracle ejecutándose cada 5 minutos
- [ ] Markets resolviéndose correctamente
- [ ] No hay memory leaks en oracle
- [ ] Logs sin errores críticos

---

## 🎯 Próximos Pasos Recomendados

### Prioridad Alta
1. Implementar wallet connect real
2. Crear tabla `bets` y guardar apuestas
3. Testing completo de flujo end-to-end
4. Implementar retiro real en claim

### Prioridad Media
5. Mejorar AMM pricing
6. Agregar UI loading states
7. Implementar historial de apuestas
8. Rate limiting y seguridad

### Prioridad Baja
9. Dashboard de analytics
10. Notificaciones push
11. Compartir en redes sociales
12. Leaderboard de apostadores

---

## 📚 Recursos

### Documentación
- [Yellow Network Docs](https://docs.yellow.org)
- [Yellow Nitrolite SDK](https://github.com/yellow-org/nitrolite)
- [Twitch API](https://dev.twitch.tv/docs/api)

### Archivos de Referencia
- `MIGRATION_GUIDE.md` - Guía de migración de DB
- `YELLOW_NETWORK_INTEGRATION.md` - Plan original
- `lib/yellow/types.ts` - TypeScript types

---

## 🐛 Problemas Conocidos

1. **TypeScript Types desactualizados**: Database types no incluyen nuevos campos Yellow
   - Solución temporal: Type casts `as any`
   - Solución permanente: Regenerar types con `supabase gen types`

2. **Wallet hardcodeado**: Usa private key del .env
   - Solución: Implementar wallet connect

3. **No tracking de bets individuales**: No hay tabla `bets`
   - Solución: Crear schema y guardar cada apuesta

4. **Claim es demo**: No retira fondos reales
   - Solución: Implementar `yellowClient.withdraw()`

---

**Última actualización:** 2026-02-06
**Autor:** Claude + Carlos
**Estado:** 🟡 En desarrollo - Core funcional, pendientes optimizaciones
