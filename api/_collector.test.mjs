import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import handler, { validateInput } from './collector.mjs';
import { montarFila } from './cobertura.mjs';

const oldFetch = globalThis.fetch;
const oldToken = process.env.GITHUB_ACTIONS_TOKEN;
afterEach(() => {
  globalThis.fetch = oldFetch;
  if (oldToken === undefined) delete process.env.GITHUB_ACTIONS_TOKEN;
  else process.env.GITHUB_ACTIONS_TOKEN = oldToken;
});

function response() {
  return { statusCode: 0, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
}

test('limita consultas e recusa entradas inválidas', () => {
  assert.equal(validateInput({ locais: 'Curitiba, PR', segmentos: ['varejo', 'manipulacao'], profundidade: 1 }).segmentos, 'varejo,manipulacao');
  assert.equal(validateInput({ locais: 'Curitiba, PR', segmentos: ['varejo'], profundidade: 1, enriquecerSites: true }).enriquecer_sites, 'true');
  assert.throws(() => validateInput({ locais: 'Curitiba, PR\nFlorianópolis, SC\nSão Paulo, SP\nManaus, AM\nRecife, PE\nSalvador, BA', segmentos: ['varejo', 'manipulacao'], profundidade: 1 }), /excede 20 buscas/);
  assert.throws(() => validateInput({ locais: 'Curitiba, PR', segmentos: ['invalido'], profundidade: 1 }), /segmento válido/);
});

test('autentica e despacha a coleta sem expor o token GitHub', async () => {
  process.env.GITHUB_ACTIONS_TOKEN = 'github-token-de-teste';
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    if (url.includes('/auth/v1/user')) return { ok: true, json: async () => ({ id: '677ed1e4-3e73-4f2c-951f-e77386f305da' }) };
    if (url.includes('/runs?')) return { ok: true, status: 200, json: async () => ({ workflow_runs: [] }) };
    if (url.endsWith('/dispatches')) return { ok: true, status: 204 };
    throw new Error('URL inesperada');
  };
  const req = { method: 'POST', headers: { authorization: 'Bearer jwt-de-teste', origin: 'https://pharmaleads.vercel.app' }, body: { action: 'start', locais: 'Curitiba, PR', segmentos: ['varejo'], profundidade: 1, emails: false } };
  const res = response();
  await handler(req, res);
  assert.equal(res.statusCode, 202);
  assert.equal(res.body.queued, true);
  assert.equal(res.body.run.status, 'queued');
  const dispatch = calls.find(x => x.url.endsWith('/dispatches'));
  assert.equal(JSON.parse(dispatch.options.body).inputs.locais, 'Curitiba, PR');
  assert.ok(!JSON.stringify(res.body).includes('github-token-de-teste'));
});

test('despacha uma rodada da cobertura nacional dentro do limite', async () => {
  process.env.GITHUB_ACTIONS_TOKEN = 'github-token-de-teste';
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    if (url.includes('/auth/v1/user')) return { ok: true, json: async () => ({ id: '677ed1e4-3e73-4f2c-951f-e77386f305da' }) };
    if (url.includes('/runs?')) return { ok: true, status: 200, json: async () => ({ workflow_runs: [] }) };
    if (url.endsWith('/dispatches')) return { ok: true, status: 204 };
    throw new Error('URL inesperada');
  };
  const res = response();
  await handler({ method: 'POST', headers: { authorization: 'Bearer jwt-de-teste', origin: 'https://pharmaleads.vercel.app' }, body: { action: 'start', cobertura: 'nacional', segmentos: ['varejo', 'manipulacao'], profundidade: 1 } }, res);
  assert.equal(res.statusCode, 202);
  const inputs = JSON.parse(calls.find(x => x.url.endsWith('/dispatches')).options.body).inputs;
  assert.equal(inputs.modo, 'nacional');
  assert.equal(inputs.rodada, '1');
  assert.equal(inputs.emails, 'false');
  assert.equal(inputs.enriquecer_sites, 'false');
  assert.equal(inputs.locais.split('\n').length, 5);
  assert.ok(Number(inputs.total_rodadas) > 1);
  assert.ok(!JSON.stringify(res.body).includes('github-token-de-teste'));
});

test('parar a coleta espera o job aparecer no GitHub e então cancela', async () => {
  process.env.GITHUB_ACTIONS_TOKEN = 'github-token-de-teste';
  process.env.COLETA_STOP_RETRY_MS = '0';
  const calls = [];
  let consultas = 0;
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    if (url.includes('/auth/v1/user')) return { ok: true, json: async () => ({ id: '677ed1e4-3e73-4f2c-951f-e77386f305da' }) };
    if (url.includes('/runs?')) {
      consultas += 1;
      const runs = consultas < 3 ? [] : [{ id: 9, status: 'queued', conclusion: null, html_url: 'https://example.test/9', created_at: '', display_title: 'Na fila' }];
      return { ok: true, status: 200, json: async () => ({ workflow_runs: runs }) };
    }
    if (url.endsWith('/cancel')) return { ok: true, status: 204 };
    throw new Error('URL inesperada');
  };
  const res = response();
  await handler({ method: 'POST', headers: { authorization: 'Bearer jwt-de-teste', origin: 'https://pharmaleads.vercel.app' }, body: { action: 'stop' } }, res);
  assert.equal(res.statusCode, 202);
  assert.equal(consultas, 3);
  assert.equal(calls.filter(x => x.url.endsWith('/cancel')).length, 1);
  delete process.env.COLETA_STOP_RETRY_MS;
});

test('parar a coleta cancela a rodada atual e a próxima já agendada', async () => {
  process.env.GITHUB_ACTIONS_TOKEN = 'github-token-de-teste';
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    if (url.includes('/auth/v1/user')) return { ok: true, json: async () => ({ id: '677ed1e4-3e73-4f2c-951f-e77386f305da' }) };
    if (url.includes('/runs?')) return { ok: true, status: 200, json: async () => ({ workflow_runs: [
      { id: 2, status: 'queued', conclusion: null, html_url: 'https://example.test/2', created_at: '', display_title: 'Nacional 2/10 · Salvador, BA' },
      { id: 1, status: 'in_progress', conclusion: null, html_url: 'https://example.test/1', created_at: '', display_title: 'Nacional 1/10 · Rio Branco, AC' },
    ] }) };
    if (url.endsWith('/cancel')) return { ok: true, status: 204 };
    throw new Error('URL inesperada');
  };
  const res = response();
  await handler({ method: 'POST', headers: { authorization: 'Bearer jwt-de-teste', origin: 'https://pharmaleads.vercel.app' }, body: { action: 'stop' } }, res);
  assert.equal(res.statusCode, 202);
  const cancelados = calls.filter(x => x.url.endsWith('/cancel')).map(x => x.url);
  assert.deepEqual(cancelados, ['https://api.github.com/repos/guilhermeH4sh/interface-pharmaleads/actions/runs/2/cancel', 'https://api.github.com/repos/guilhermeH4sh/interface-pharmaleads/actions/runs/1/cancel']);
  assert.equal(res.body.run.id, 1);
});

test('a fila nacional cabe em 20 buscas e cobre as 27 UFs antes do interior', () => {
  const termos = { varejo: 3, manipulacao: 1, homeopatia: 1, veterinaria: 1, distribuidoras: 2 };
  const fila = montarFila(['varejo', 'manipulacao'], termos);
  assert.equal(fila[0].length, 5);
  assert.deepEqual(fila[0].map(local => local.slice(-2)), ['AC', 'AL', 'DF', 'ES', 'PR']);
  assert.equal(new Set(fila.flat().slice(0, 27).map(local => local.slice(-2))).size, 27);
  assert.equal(fila.flat()[27], 'Santarém, PA');
  assert.ok(fila.flat().filter(local => local.endsWith('SP')).length >= 2);
  for (const segmentos of [['manipulacao'], ['varejo', 'manipulacao'], ['varejo', 'manipulacao', 'homeopatia', 'veterinaria', 'distribuidoras']]) {
    const porLocal = segmentos.reduce((soma, nome) => soma + termos[nome], 0);
    for (const rodada of montarFila(segmentos, termos)) assert.ok(rodada.length * porLocal <= 20);
  }
});

test('recusa usuário sem permissão antes de chamar GitHub', async () => {
  process.env.GITHUB_ACTIONS_TOKEN = 'github-token-de-teste';
  let calls = 0;
  globalThis.fetch = async () => { calls++; return { ok: true, json: async () => ({ id: 'outro-usuario' }) }; };
  const res = response();
  await handler({ method: 'GET', headers: { authorization: 'Bearer jwt-de-teste' } }, res);
  assert.equal(res.statusCode, 401);
  assert.equal(calls, 1);
});
