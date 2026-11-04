import { entradaNacional } from './cobertura.mjs';

const SUPABASE_URL = 'https://qxsdcrywsjkrpcbfgbxb.supabase.co';
const PUBLISHABLE_KEY = 'sb_publishable_9AdBAjeEHFysAVpC7VCLMw_cDgQ4Fl0';
const AUTHORIZED_USER_ID = '677ed1e4-3e73-4f2c-951f-e77386f305da';
const REPO = 'guilhermeH4sh/interface-pharmaleads';
const WORKFLOW = 'cloud-collect.yml';
const TERMS = { varejo: 3, manipulacao: 1, homeopatia: 1, veterinaria: 1, distribuidoras: 2 };
const ACTIVE = new Set(['queued', 'in_progress', 'waiting', 'pending', 'requested']);
const ACTIONS_URL = `https://github.com/${REPO}/actions/workflows/${WORKFLOW}`;
const STOP_TRIES = 6;

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
  return { locais: [...new Set(locais)].join('\n'), segmentos: segmentos.join(','), profundidade: String(profundidade), emails: body.emails === true ? 'true' : 'false', enriquecer_sites: body.enriquecerSites === true ? 'true' : 'false' };
}

async function authorized(req) {
  const match = /^Bearer ([^\s]+)$/.exec(header(req, 'authorization'));
  if (!match) return false;
  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: PUBLISHABLE_KEY, Authorization: `Bearer ${match[1]}` },
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) return false;
  const user = await response.json();
  return user.id === AUTHORIZED_USER_ID;
}

async function github(path, token, method = 'GET', body) {
  const response = await fetch(`https://api.github.com/repos/${REPO}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`GitHub respondeu HTTP ${response.status}.`);
  return response.status === 204 ? null : response.json();
}

function resumir(run) {
  return run ? { id: run.id, status: run.status, conclusion: run.conclusion, url: run.html_url, created_at: run.created_at, title: run.display_title } : null;
}

async function runsRecentes(token) {
  const data = await github(`/actions/workflows/${WORKFLOW}/runs?event=workflow_dispatch&per_page=10`, token);
  return Array.isArray(data.workflow_runs) ? data.workflow_runs : [];
}

function escolherRun(runs) {
  const ativos = runs.filter(run => ACTIVE.has(run.status));
  return ativos.find(run => run.status === 'in_progress') || ativos[0] || runs[0] || null;
}

function coberturaConcluida(run) {
  if (!run || run.status !== 'completed' || run.conclusion !== 'success') return false;
  const match = /^Nacional (\d+)\/(\d+)(?: ·|$)/.exec(run.display_title || '');
  return Boolean(match && Number(match[1]) === Number(match[2]));
}

function filaLocal() {
  return { id: 0, status: 'queued', conclusion: null, url: ACTIONS_URL, created_at: new Date().toISOString(), title: 'Na fila' };
}

function esperar(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runsAtivas(token) {
  return (await runsRecentes(token)).filter(run => ACTIVE.has(run.status));
}

async function cancelarAtivas(token) {
  for (let tentativa = 1; tentativa <= STOP_TRIES; tentativa++) {
    const ativos = await runsAtivas(token);
    if (ativos.length) {
      for (const run of ativos) await github(`/actions/runs/${run.id}/cancel`, token, 'POST');
      return ativos;
    }
    const espera = Number(process.env.COLETA_STOP_RETRY_MS || 800);
    if (tentativa < STOP_TRIES && espera > 0) await esperar(espera);
  }
  return [];
}

export default async function handler(req, res) {
  try {
    const origin = header(req, 'origin');
    if (origin && origin !== 'https://pharmaleads.vercel.app') return respond(res, 403, { error: 'Origem não permitida.' });
    if (req.method !== 'GET' && req.method !== 'POST') return respond(res, 405, { error: 'Método não permitido.' });
    if (!await authorized(req)) return respond(res, 401, { error: 'Entre com o usuário autorizado no Supabase.' });
    const token = process.env.GITHUB_ACTIONS_TOKEN;
    if (!token) return respond(res, 503, { error: 'Falta configurar GITHUB_ACTIONS_TOKEN na Vercel.' });
    if (req.method === 'GET') return respond(res, 200, { run: resumir(escolherRun(await runsRecentes(token))) });
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    if (JSON.stringify(body || {}).length > 10000) return respond(res, 413, { error: 'Configuração muito grande.' });
    if (body?.action === 'start') {
      const runs = await runsRecentes(token);
      const active = escolherRun(runs.filter(run => ACTIVE.has(run.status)));
      if (active) return respond(res, 409, { error: 'Já existe uma coleta online em andamento.', run: resumir(active) });
      if (body.cobertura === 'nacional' && coberturaConcluida(escolherRun(runs))) {
        return respond(res, 409, { error: 'A cobertura nacional já foi concluída. Para coletar de novo, inicie buscas avulsas ou solicite uma nova cobertura.' });
      }
      let input;
      try { input = body.cobertura === 'nacional' ? entradaNacional(body, TERMS) : validateInput(body); }
      catch (error) { return respond(res, 400, { error: error.message }); }
      await github(`/actions/workflows/${WORKFLOW}/dispatches`, token, 'POST', { ref: 'main', inputs: { ...input, request_id: crypto.randomUUID() } });
      return respond(res, 202, { queued: true, run: filaLocal() });
    }
    if (body?.action === 'stop') {
      const ativos = await cancelarAtivas(token);
      const run = resumir(ativos.find(run => run.status === 'in_progress') || ativos[0] || escolherRun(await runsRecentes(token)));
      return respond(res, 202, { cancelling: Boolean(ativos.length), run });
    }
    return respond(res, 400, { error: 'Ação inválida.' });
  } catch (error) {
    return respond(res, 502, { error: error instanceof Error ? error.message : 'Serviço de coleta indisponível.' });
  }
}
