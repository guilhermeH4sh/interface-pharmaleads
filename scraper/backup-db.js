import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const { data, error } = await supabase.from('pharmaleads').select('*').order('id');
if (error) { console.error(error.message); process.exit(1); }

const arquivo = process.argv[2] || `backup-pharmaleads-${Date.now()}.json`;
fs.writeFileSync(arquivo, JSON.stringify(data, null, 2));
console.log(`Backup: ${data.length} registros -> ${arquivo}`);

// Resumo por origem
const origem = {};
for (const r of data) {
  const obs = (r.observacoes || '').slice(0, 45);
  origem[obs] = (origem[obs] || 0) + 1;
}
console.table(origem);
