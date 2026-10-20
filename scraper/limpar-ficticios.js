/**
 * Limpeza de dados fictícios da tabela `pharmaleads`.
 * - Remove leads 100% fictícios (seed manual sem origem pública).
 * - Nos leads reais do OpenStreetMap, apaga campos que foram gerados
 *   sinteticamente (telefone, WhatsApp, e-mail, razão social, CNAE)
 *   e placeholders de endereço ("Avenida Principal", "S/N", "Centro Comercial", "70000-000").
 * Uso: node scraper/limpar-ficticios.js            (simulação)
 *      node scraper/limpar-ficticios.js --aplicar  (grava no banco)
 */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const APLICAR = process.argv.includes('--aplicar');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const { data, error } = await supabase.from('pharmaleads').select('*').order('id');
if (error) { console.error(error.message); process.exit(1); }

const isOsm = (r) => /^Estabelecimento real mapeado via/.test(r.observacoes || '');
const fictícios = data.filter(r => !isOsm(r));
const osm = data.filter(isOsm);

console.log(`Total: ${data.length} | Fictícios a remover: ${fictícios.length} | OSM a higienizar: ${osm.length}`);
console.log(`Modo: ${APLICAR ? 'APLICAR' : 'SIMULAÇÃO'}\n`);

const agora = new Date().toLocaleString('pt-BR');
let ok = 0, falhas = 0;

for (const r of osm) {
  const coords = (r.observacoes.match(/\(([-\d.]+),\s*([-\d.]+)\)/) || []).slice(1).join(', ');
  const cepMatch = r.observacoes.match(/CEP:\s*([\d-]+)/);
  const cep = cepMatch && cepMatch[1] !== '70000-000' ? cepMatch[1] : null;

  const bairro = r.bairro && r.bairro !== 'Centro Comercial' ? r.bairro : null;
  let endereco = r.endereco || null;
  if (endereco && /^Avenida Principal/.test(endereco)) endereco = null;
  if (endereco) endereco = endereco.replace(', S/N', '').replace(' - Centro Comercial', '');

  const update = {
    razao_social: null,
    telefone: null,
    whatsapp: null,
    email: null,
    cnae: null,
    bairro,
    endereco,
    observacoes: `Estabelecimento real mapeado via OpenStreetMap (${coords}).${cep ? ' CEP: ' + cep + '.' : ''} Telefone, WhatsApp, e-mail e CNPJ não encontrados em fonte pública.`,
    historico: [
      { data: agora, texto: 'Auditoria: dados de contato sintéticos removidos. Apenas dados públicos reais mantidos.' },
      ...(Array.isArray(r.historico) ? r.historico : [])
    ],
    updated_at: new Date().toISOString()
  };

  if (!APLICAR) { ok++; continue; }
  const { error: e } = await supabase.from('pharmaleads').update(update).eq('id', r.id);
  if (e) { falhas++; console.warn(`#${r.id} ${r.nome}: ${e.message}`); } else ok++;
}

if (APLICAR && fictícios.length) {
  const { error: e } = await supabase.from('pharmaleads').delete().in('id', fictícios.map(r => r.id));
  if (e) console.warn('Erro ao remover fictícios:', e.message);
}

console.log(`Higienizados: ${ok} | Falhas: ${falhas} | Removidos: ${APLICAR ? fictícios.length : 0}`);
fictícios.forEach(r => console.log(`  - remover #${r.id} ${r.nome} (${r.cidade}/${r.uf})`));
