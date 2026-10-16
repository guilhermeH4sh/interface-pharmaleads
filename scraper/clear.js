import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Credenciais ausentes no .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function limparTabela() {
  console.log('🧹 Iniciando limpeza dos registros de teste da tabela "pharmaleads"...');
  
  // No Supabase, deletar onde id > 0 limpa todos os registros
  const { data, error } = await supabase
    .from('pharmaleads')
    .delete()
    .gte('id', 0)
    .select('id');

  if (error) {
    console.error('❌ Erro ao limpar a tabela:', error.message);
    process.exit(1);
  }

  console.log(`✅ Sucesso! ${data?.length || 0} registros de teste foram removidos da tabela "pharmaleads".`);
  process.exit(0);
}

limparTabela();
