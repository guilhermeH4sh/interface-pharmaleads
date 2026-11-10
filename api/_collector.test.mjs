import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import handler, { validateInput } from './collector.mjs';
import { montarFila } from './cobertura.mjs';

const oldFetch = globalThis.fetch;
const oldUrl = process.env.RENDER_COLLECTOR_URL;
const oldToken = process.env.RENDER_COLLECTOR_TOKEN;

afterEach(() => {
  globalThis.fetch = oldFetch;
  if (oldUrl === undefined) delete process.env.RENDER_COLLECTOR_URL;
  else process.env.RENDER_COLLECTOR_URL = oldUrl;
  if (oldToken === undefined) delete process.env.RENDER_COLLECTOR_TOKEN;
  else process.env.RENDER_COLLECTOR_TOKEN = oldToken;
});

function response() {
  return { statusCode: 0, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
}

function setupRender(handlerFn) {
  process.env.RENDER_COLLECTOR_URL = 'https://pharmaleads-collector.onrender.com';
  process.env.RENDER_COLLECTOR_TOKEN = 'render-token-de-teste';
  const calls = [];
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url, options });
    if (url.includes('/auth/v1/user')) return { ok: true, status: 200, json: async () => ({ id: '677ed1e4-3e73-4f2c-951f-e77386f305da' }) };
    return handlerFn(url, options);
  };
  return calls;
}

test('limita consultas e força e-mail e enriquecimento', () => {
  const result = validateInput({ locais: 'Curitiba, PR', segmentos: ['varejo', 'manipulacao'], profundidade: 1 });
  assert.equal(result.segmentos, 'varejo,manipulacao');
  assert.equal(result.emails, 'true');
  assert.equal(result.enriquecer_sites, 'true');
  assert.equal(result.modo, 'avulsa');
  assert.throws(() => validateInput({ locais: 'Curitiba, PR\nFlorianópolis, SC\nSão Paulo, SP\nManaus, AM\nRecife, PE\nSalvador, BA', segmentos: ['varejo', 'manipulacao'], profundidade: 1 }), /excede 20 buscas/);
  assert.throws(() => validateInput({ locais: 'Curitiba, PR', segmentos: ['invalido'], profundidade: 1 }), /segmento válido/);
});

test('autentica e encaminha coleta ao Render sem expor o token', async () => {
  const calls = setupRender(async (url, options) => {
    assert.equal(url, 'https://pharmaleads-collector.onrender.com/v1/start');
    assert.equal(options.headers.Authorization, 'Bearer render-token-de-teste');
    return { ok: true, status: 202, json: async () => ({ queued: true, run: { id: 1, status: 'queued' } }) };
  });
  const req = { method: 'POST', headers: { authorization: 'Bearer jwt-de-teste', origin: 'https://pharmaleads.vercel.app' }, body: { action: 'start', locais: 'Curitiba, PR', segmentos: ['varejo'], profundidade: 1 } };
  const res = response();
  await handler(req, res);
  assert.equal(res.statusCode, 202);
  assert.equal(res.body.run.status, 'queued');
  const dispatch = calls.find(call => call.url.endsWith('/v1/start'));
  const body = JSON.parse(dispatch.options.body);
  assert.equal(body.locais, 'Curitiba, PR');
  assert.equal(body.emails, 'true');
  assert.equal(body.enriquecer_sites, 'true');
  assert.ok(!JSON.stringify(res.body).includes('render-token-de-teste'));
});

test('encaminha primeira rodada nacional e o Render continua a fila', async () => {
  const calls = setupRender(async () => ({ ok: true, status: 202, json: async () => ({ queued: true, run: { id: 2, status: 'queued' } }) }));
  const res = response();
  await handler({ method: 'POST', headers: { authorization: 'Bearer jwt-de-teste' }, body: { action: 'start', cobertura: 'nacional', segmentos: ['varejo', 'manipulacao'], profundidade: 1 } }, res);
  assert.equal(res.statusCode, 202);
  const input = JSON.parse(calls.find(call => call.url.endsWith('/v1/start')).options.body);
  assert.equal(input.modo, 'nacional');
  assert.equal(input.rodada, '1');
  assert.equal(input.locais.split('\n').length, 2);
  assert.ok(Number(input.total_rodadas) > 1);
});

test('consulta status e solicita parada no Render', async () => {
  const calls = setupRender(async (url) => {
    if (url.endsWith('/v1/status')) return { ok: true, status: 200, json: async () => ({ run: { id: 9, status: 'in_progress' } }) };
    if (url.endsWith('/v1/stop')) return { ok: true, status: 202, json: async () => ({ cancelling: true, run: { id: 9, status: 'cancelling' } }) };
    throw new Error('URL inesperada');
  });
  const getRes = response();
  await handler({ method: 'GET', headers: { authorization: 'Bearer jwt-de-teste' } }, getRes);
  assert.equal(getRes.body.run.status, 'in_progress');
  const stopRes = response();
  await handler({ method: 'POST', headers: { authorization: 'Bearer jwt-de-teste' }, body: { action: 'stop' } }, stopRes);
  assert.equal(stopRes.statusCode, 202);
  assert.equal(stopRes.body.cancelling, true);
  assert.deepEqual(calls.filter(call => call.url.includes('onrender.com')).map(call => call.url), [
    'https://pharmaleads-collector.onrender.com/v1/status',
    'https://pharmaleads-collector.onrender.com/v1/stop',
  ]);
});

test('propaga conflito de coleta já ativa', async () => {
  setupRender(async () => ({ ok: false, status: 409, json: async () => ({ error: 'Já existe uma coleta online em andamento.', run: { id: 44, status: 'in_progress' } }) }));
  const res = response();
  await handler({ method: 'POST', headers: { authorization: 'Bearer jwt-de-teste' }, body: { action: 'start', locais: 'Curitiba, PR', segmentos: ['varejo'], profundidade: 1 } }, res);
  assert.equal(res.statusCode, 409);
  assert.equal(res.body.run.id, 44);
});

test('a fila nacional cabe em oito buscas e cobre as 27 UFs antes do interior', () => {
  const termos = { varejo: 3, manipulacao: 1, homeopatia: 1, veterinaria: 1, distribuidoras: 2 };
  const fila = montarFila(['varejo', 'manipulacao'], termos);
  assert.equal(fila[0].length, 2);
  assert.equal(new Set(fila.flat().slice(0, 27).map(local => local.slice(-2))).size, 27);
  assert.equal(fila.flat()[27], 'Santarém, PA');
  for (const rodada of fila) assert.ok(rodada.length * 4 <= 8);
});

test('recusa usuário sem permissão antes de chamar Render', async () => {
  process.env.RENDER_COLLECTOR_URL = 'https://pharmaleads-collector.onrender.com';
  process.env.RENDER_COLLECTOR_TOKEN = 'segredo';
  let calls = 0;
  globalThis.fetch = async () => { calls++; return { ok: true, json: async () => ({ id: 'outro-usuario' }) }; };
  const res = response();
  await handler({ method: 'GET', headers: { authorization: 'Bearer jwt-de-teste' } }, res);
  assert.equal(res.statusCode, 401);
  assert.equal(calls, 1);
});
