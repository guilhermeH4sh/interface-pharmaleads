import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();
const s = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const { data, error } = await s.from('pharmaleads').select('*').order('id');
if (error) { console.error(error.message); process.exit(1); }

console.log('Registros:', data.length, '| Colunas:', Object.keys(data[0] || {}).join(', '));
const cols = Object.keys(data[0] || {});
for (const c of cols) {
  const preenchidos = data.filter(r => r[c] !== null && r[c] !== '' && !(Array.isArray(r[c]) && !r[c].length));
  const distintos = [...new Set(preenchidos.map(r => JSON.stringify(r[c])))];
  console.log(`\n[${c}] preenchidos=${preenchidos.length} distintos=${distintos.length}`);
  if (!['id', 'created_at', 'updated_at', 'historico', 'observacoes'].includes(c)) {
    console.log('  ', distintos.slice(0, 12).join(' | ').slice(0, 900));
  }
}

const suspeitos = /Avenida Principal|S\/N|Centro Comercial|Regi[aã]o (Central|Comercial)|Avenida Comercial|70000-000|Ltda|Sob auditoria|Drogaria Regional/i;
const hits = data.filter(r => suspeitos.test(JSON.stringify({ ...r, historico: null })));
console.log('\nPlaceholders suspeitos:', hits.length);
hits.forEach(r => console.log(`  #${r.id} ${r.nome} | ${r.endereco} | ${r.bairro}`));

console.log('\nSites:');
data.filter(r => r.website).forEach(r => console.log(`  #${r.id} ${r.nome} -> ${r.website}`));

// Duplicatas de nome+coordenada
const coords = {};
data.forEach(r => { const k = (r.observacoes.match(/\(([^)]+)\)/) || [])[1]; (coords[k] ||= []).push(`#${r.id} ${r.nome}`); });
console.log('\nCoordenadas repetidas:');
Object.entries(coords).filter(([, v]) => v.length > 1).forEach(([k, v]) => console.log(`  ${k}: ${v.join(', ')}`));
