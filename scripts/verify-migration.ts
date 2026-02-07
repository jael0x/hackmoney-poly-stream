/**
 * Script para verificar si la migración de Yellow Network se aplicó correctamente
 *
 * Ejecutar con: npx tsx scripts/verify-migration.ts
 */

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyMigration() {
  console.log('🔍 Verificando migración de Yellow Network...\n');

  // 1. Verificar si podemos leer la tabla markets con las nuevas columnas
  console.log('📋 Verificando columnas...');
  const { data: testRead, error: readError } = await supabase
    .from('markets')
    .select('id, app_session_id, pool_yes_address, pool_no_address, oracle_address, yes_amount, no_amount, twitch_metric, target_value, winner')
    .limit(1);

  if (readError) {
    console.error('❌ Error al leer columnas:', readError.message);
    if (readError.message.includes('column') && readError.message.includes('does not exist')) {
      console.log('\n❌ Las columnas de Yellow Network NO están creadas aún.');
      console.log('\n💡 Necesitas ejecutar la migración primero:');
      console.log('   1. Ve a: https://supabase.com/dashboard/project/hemrblmhvgzilttbodpp/editor');
      console.log('   2. Abre el SQL Editor');
      console.log('   3. Copia y pega el contenido de: supabase/migrations/20260206154039_add_yellow_network_fields.sql');
      console.log('   4. Ejecuta el query');
    } else {
      console.log('\n💡 Verifica tu configuración de Supabase o ejecuta la migración manualmente');
    }
    return;
  }

  console.log('✅ Todas las columnas de Yellow Network existen!\n');
  console.log('   Columnas verificadas:');
  console.log('   - app_session_id');
  console.log('   - pool_yes_address');
  console.log('   - pool_no_address');
  console.log('   - oracle_address');
  console.log('   - yes_amount');
  console.log('   - no_amount');
  console.log('   - twitch_metric');
  console.log('   - target_value');
  console.log('   - winner');

  // 2. Probar inserción
  console.log('\n🧪 Probando inserción de datos...');
  const { data: testMarket, error: insertError } = await supabase
    .from('markets')
    .insert({
      question: 'Test Yellow Network Migration',
      description: 'Testing new fields',
      yes_price: 50,
      no_price: 50,
      twitch_metric: 'viewer_count',
      target_value: 5000,
      yes_amount: '0',
      no_amount: '0',
    })
    .select()
    .single();

  if (insertError) {
    console.error('❌ Error al insertar:', insertError.message);
    console.log('💡 Ejecuta la migración primero si ves errores de "column does not exist"');
  } else {
    console.log('✅ Inserción exitosa!');
    console.log('   Market ID:', testMarket.id);
    console.log('   twitch_metric:', testMarket.twitch_metric);
    console.log('   target_value:', testMarket.target_value);

    // Eliminar el test
    await supabase.from('markets').delete().eq('id', testMarket.id);
    console.log('✅ Test market eliminado');
  }

  console.log('\n✨ Verificación completada!\n');
}

verifyMigration().catch(console.error);
