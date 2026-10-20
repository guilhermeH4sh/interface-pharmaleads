/**
 * Enriquecimento com dados REAIS e PÚBLICOS.
 *
 * Etapa 1 — Google Places API (New), dados oficiais do Google Business Profile:
 *   telefone, website, nota, nº de avaliações, status e place_id.
 *   Só grava se o resultado do Google estiver a no máximo 150 m da coordenada
 *   OSM do lead e com nome compatível (evita atribuir dados de outra farmácia).
 *
 * Etapa 2 — Receita Federal (BrasilAPI / dados abertos do CNPJ):
 *   razão social, CNAE e telefone cadastral — somente para leads que JÁ têm CNPJ.
 *
 * Nada é deduzido: campos não encontrados permanecem null.
 *
 * Uso:
 *   node scraper/enriquecer.js            (simulação, não grava)
 *   node scraper/enriquecer.js --aplicar  (grava no Supabase)
 */
import axios from 'axios';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const APLICAR = process.argv.includes('--aplicar');
const GOOGLE_KEY = process.env.GOOGLE_PLACES_API_KEY;
const RAIO_MAX_METROS = 150;

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// -----------------------------------------------------------------------------
// Utilidades
// -----------------------------------------------------------------------------
function distanciaMetros(lat1, lon1, lat2, lon2) {
  const R = 6371000, rad = (d) => d * Math.PI / 180;
  const a = Math.sin(rad(lat2 - lat1) / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lon2 - lon1) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

const normalizar = (s) => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\b(farmacia|drogaria|drogarias|farmacias|e|de|do|da|ltda)\b/g, ' ')
  .replace(/\s+/g, ' ').trim();

function nomesCompativeis(a, b) {
  const ta = new Set(normalizar(a).split(' ').filter(Boolean));
  const tb = new Set(normalizar(b).split(' ').filter(Boolean));
  if (!ta.size || !tb.size) return false;
  return [...ta].some(t => tb.has(t));
}

function coordenadasDoLead(lead) {
  const m = (lead.observacoes || '').match(/\((-?\d+\.\d+),\s*(-?\d+\.\d+)\)/);
  return m ? { lat: parseFloat(m[1]), lon: parseFloat(m[2]) } : null;
}

function formatarTelefone(t) {
  if (!t) return null;
  const d = t.replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, '');
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return null;
}

// -----------------------------------------------------------------------------
// Etapa 1 — Google Places API (New)
// -----------------------------------------------------------------------------
async function buscarNoGoogle(lead, coord) {
  const { data } = await axios.post(
    'https://places.googleapis.com/v1/places:searchText',
    {
      textQuery: `${lead.nome} ${lead.cidade} ${lead.uf}`,
      languageCode: 'pt-BR',
      regionCode: 'BR',
      locationBias: { circle: { center: { latitude: coord.lat, longitude: coord.lon }, radius: 500 } },
      maxResultCount: 5
    },
    {
      headers: {
        'X-Goog-Api-Key': GOOGLE_KEY,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.nationalPhoneNumber,places.websiteUri,places.rating,places.userRatingCount,places.businessStatus,places.googleMapsUri'
      },
      timeout: 15000
    }
  );

  const candidatos = (data.places || [])
    .map(p => ({ ...p, dist: distanciaMetros(coord.lat, coord.lon, p.location.latitude, p.location.longitude) }))
    .filter(p => p.dist <= RAIO_MAX_METROS && nomesCompativeis(lead.nome, p.displayName?.text))
    .sort((a, b) => a.dist - b.dist);

  return candidatos[0] || null;
}

// -----------------------------------------------------------------------------
// Etapa 2 — Receita Federal via BrasilAPI (somente com CNPJ real já conhecido)
// -----------------------------------------------------------------------------
async function consultarCnpj(cnpj) {
  const limpo = (cnpj || '').replace(/\D/g, '');
  if (limpo.length !== 14) return null;
  const { data } = await axios.get(`https://brasilapi.com.br/api/cnpj/v1/${limpo}`, { timeout: 15000 });
  return data;
}

// -----------------------------------------------------------------------------
// Execução
// -----------------------------------------------------------------------------
async function main() {
  const { data: leads, error } = await supabase.from('pharmaleads').select('*').order('id');
  if (error) throw new Error(error.message);

  console.log(`Modo: ${APLICAR ? 'APLICAR' : 'SIMULAÇÃO'} | Leads: ${leads.length}`);
  if (!GOOGLE_KEY) console.warn('⚠️ GOOGLE_PLACES_API_KEY ausente no .env — etapa Google será ignorada.');

  const resumo = { google: 0, semMatch: 0, receita: 0, erros: 0 };

  for (const lead of leads) {
    const update = {};
    const notas = [];

    // Etapa 1 — Google
    const coord = coordenadasDoLead(lead);
    if (GOOGLE_KEY && coord) {
      try {
        const p = await buscarNoGoogle(lead, coord);
        if (p) {
          const tel = formatarTelefone(p.nationalPhoneNumber);
          if (tel && !lead.telefone) update.telefone = tel;
          if (p.websiteUri && !lead.website) update.website = p.websiteUri;
          update.google_place_id = p.id;
          update.google_rating = p.rating ?? null;
          update.google_reviews = p.userRatingCount ?? null;
          update.google_status = p.businessStatus ?? null;
          update.google_maps_url = p.googleMapsUri ?? null;
          notas.push(`Google Places: perfil oficial confirmado a ${Math.round(p.dist)} m (${p.displayName?.text}).`);
          resumo.google++;
        } else {
          notas.push('Google Places: nenhum perfil confirmado na localização.');
          resumo.semMatch++;
        }
      } catch (e) {
        resumo.erros++;
        console.warn(`#${lead.id} Google: ${e.response?.data?.error?.message || e.message}`);
        if (e.response?.status === 403 || e.response?.status === 400) break;
      }
      await sleep(150);
    }

    // Etapa 2 — Receita (só se CNPJ real existir)
    if (lead.cnpj) {
      try {
        const r = await consultarCnpj(lead.cnpj);
        if (r) {
          update.razao_social = r.razao_social || null;
          update.cnae = r.cnae_fiscal ? `${r.cnae_fiscal} - ${r.cnae_fiscal_descricao}` : null;
          const telReceita = formatarTelefone(r.ddd_telefone_1);
          if (telReceita && !lead.telefone && !update.telefone) update.telefone = telReceita;
          notas.push('Receita Federal: dados cadastrais do CNPJ confirmados.');
          resumo.receita++;
        }
      } catch (e) {
        resumo.erros++;
        console.warn(`#${lead.id} Receita: ${e.message}`);
      }
      await sleep(400);
    }

    if (!Object.keys(update).length && !notas.length) continue;

    console.log(`#${lead.id} ${lead.nome} -> ${JSON.stringify(update)}`);

    if (APLICAR && Object.keys(update).length) {
      update.historico = [
        { data: new Date().toLocaleString('pt-BR'), texto: `Enriquecimento: ${notas.join(' ')}` },
        ...(lead.historico || [])
      ];
      update.updated_at = new Date().toISOString();
      const { error: e } = await supabase.from('pharmaleads').update(update).eq('id', lead.id);
      if (e) { resumo.erros++; console.warn(`#${lead.id} gravação: ${e.message}`); }
    }
  }

  console.log('\nResumo:', resumo);
}

main().catch(e => { console.error(e.message); process.exit(1); });
