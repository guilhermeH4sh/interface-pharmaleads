import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Erro: SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configurados.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testConnection() {
  console.log('🔄 Testando conexão com a tabela "pharmaleads"...');
  const { data, error } = await supabase.from('pharmaleads').select('*').limit(1);
  
  if (error) {
    console.error('❌ Erro ao consultar a tabela:', error.message);
  } else {
    console.log('✅ Conexão bem-sucedida! Tabela acessível no Supabase.');
    console.log(`📊 Registros encontrados atualmente: ${data.length}`);
  }
}

testConnection();
