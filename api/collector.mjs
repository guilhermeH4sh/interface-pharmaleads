import { entradaNacional } from './cobertura.mjs';

const SUPABASE_URL = 'https://qxsdcrywsjkrpcbfgbxb.supabase.co';
const PUBLISHABLE_KEY = 'sb_publishable_9AdBAjeEHFysAVpC7VCLMw_cDgQ4Fl0';
const AUTHORIZED_USER_ID = '677ed1e4-3e73-4f2c-951f-e77386f305da';
const TERMS = { varejo: 3, manipulacao: 1, homeopatia: 1, veterinaria: 1, distribuidoras: 2 };

function respond(res, status, body) { return res.status(status).json(body); }
function header(req, name) { return req.headers?.[name] || req.headers?.[name.toLowerCase()] || ''; }

export function validateInput(body) {
  if (!body || typeof body !== 'object') throw new Error('Configuração inválida.');
  const locais = typeof body.locais === 'string' ? body.locais.split(/\r?\n/).map(x => x.trim()).filter(Boolean) : [];
  const segmentos = Array.isArray(body.segmentos) ? [...new Set(body.segmentos)] : [];
  const profundidade = Number(body.profundidade);
  if (!locais.length || locais.length > 20 || locais.some(x => x.length > 100 || /[\x00-\x1f]|#!#/.test(x))) throw new Error('Informe de 1 a 20 locais válidos, um por linha.');
  if (!segmentos.length || segmentos.some(x => typeof x !== 'string' || !Object.hasOwn(TERMS, x))) throw new Error('Escolha pelo menos um segmento válido.');
  if (!Number.isInteger(profundidade) || profundidade < 1 || profundidade > 10) throw new Error('A profundidade deve estar entre 1 e 10.');
  if (locais.length * segmentos.reduce((sum, x) => sum + TERMS[x], 0) > 20) throw new Error('Esta coleta excede 20 buscas. Reduza os locais ou segmentos.');
  const unicos = [...new Set(locais)];
  return {
    locais: unicos.join('\n'), segmentos: segmentos.join(','), profundidade: String(profundidade),
    emails: 'true', enriquecer_sites: 'true', modo: 'avulsa', resumo: unicos.join(' · ').slice(0, 180),
  };
}

async function authorized(req) {
  const match = /^Bearer ([^\s]+)$/.exec(header(req, 'authorization'));
  if (!match) return false;
  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: PUBLISHABLE_KEY, Authorization: `Bearer ${match[1]}` }, signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) return false;
  const user = await response.json();
  return user.id === AUTHORIZED_USER_ID;
}

function configRender() {
  const base = (process.env.RENDER_COLLECTOR_URL || '').replace(/\/+$/, '');
  const token = process.env.RENDER_COLLECTOR_TOKEN || '';
  let parsed;
  try { parsed = new URL(base); } catch { parsed = null; }
  if (!parsed || parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new Error('Configure RENDER_COLLECTOR_URL com a URL HTTPS do Web Service na Vercel.');
  }
  if (!token) throw new Error('Configure RENDER_COLLECTOR_TOKEN na Vercel.');
  return { base, token };
}

async function renderRequest(path, method = 'GET', body) {
  const { base, token } = configRender();
  const response = await fetch(`${base}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
    signal: AbortSignal.timeout(30000),
  });
  const payload = await response.json().catch(() => ({ error: `Render respondeu HTTP ${response.status}.` }));
  return { status: response.status, payload };
}

export default async function handler(req, res) {
  res.setHeader?.('Cache-Control', 'no-store');
  try {
    const origin = header(req, 'origin');
    if (origin && origin !== 'https://pharmaleads.vercel.app') return respond(res, 403, { error: 'Origem não permitida.' });
    if (req.method !== 'GET' && req.method !== 'POST') return respond(res, 405, { error: 'Método não permitido.' });
    if (!await authorized(req)) return respond(res, 401, { error: 'Entre com o usuário autorizado no Supabase.' });
    if (req.method === 'GET') {
      const upstream = await renderRequest('/v1/status');
      return respond(res, upstream.status, upstream.payload);
    }
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    if (JSON.stringify(body || {}).length > 10000) return respond(res, 413, { error: 'Configuração muito grande.' });
    if (body?.action === 'start') {
      let input;
      try { input = body.cobertura === 'nacional' ? entradaNacional(body, TERMS) : validateInput(body); }
      catch (error) { return respond(res, 400, { error: error.message }); }
      const upstream = await renderRequest('/v1/start', 'POST', { ...input, request_id: crypto.randomUUID() });
      return respond(res, upstream.status, upstream.payload);
    }
    if (body?.action === 'stop') {
      const upstream = await renderRequest('/v1/stop', 'POST', {});
      return respond(res, upstream.status, upstream.payload);
    }
    return respond(res, 400, { error: 'Ação inválida.' });
  } catch (error) {
    return respond(res, 502, { error: error instanceof Error ? error.message : 'Serviço de coleta indisponível.' });
  }
}
