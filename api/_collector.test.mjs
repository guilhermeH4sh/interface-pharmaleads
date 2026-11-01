import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import handler, { validateInput } from './collector.mjs';

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
  const dispatch = calls.find(x => x.url.endsWith('/dispatches'));
  assert.equal(JSON.parse(dispatch.options.body).inputs.locais, 'Curitiba, PR');
  assert.ok(!JSON.stringify(res.body).includes('github-token-de-teste'));
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
