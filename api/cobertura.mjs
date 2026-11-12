import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const plano = JSON.parse(readFileSync(fileURLToPath(new URL('./cobertura_nacional.json', import.meta.url)), 'utf8'));
const LIMITE_BUSCAS_NACIONAL = 8;
const MAX_RODADAS_NACIONAL = 20;

export const CAPITAIS = plano.capitais;
export const INTERIOR = plano.interior;
export const LOCAIS_NACIONAIS = [...CAPITAIS, ...INTERIOR];

export function montarFila(segmentos, termos) {
  const porLocal = segmentos.reduce((soma, nome) => soma + termos[nome], 0);
  const tamanho = Math.floor(LIMITE_BUSCAS_NACIONAL / porLocal);
  if (!porLocal || tamanho < 1) throw new Error('Os segmentos escolhidos não cabem no limite da rodada.');
  const fila = [];
  const locaisDaExecucao = LOCAIS_NACIONAIS.slice(0, tamanho * MAX_RODADAS_NACIONAL);
  for (let i = 0; i < locaisDaExecucao.length; i += tamanho) fila.push(locaisDaExecucao.slice(i, i + tamanho));
  return fila;
}

export function entradaNacional(body, termos) {
  if (!body || typeof body !== 'object') throw new Error('Configuração inválida.');
  const segmentos = Array.isArray(body.segmentos) ? [...new Set(body.segmentos)] : [];
  const profundidade = Number(body.profundidade);
  if (!segmentos.length || segmentos.some(nome => typeof nome !== 'string' || !Object.hasOwn(termos, nome))) throw new Error('Escolha pelo menos um segmento válido.');
  if (!Number.isInteger(profundidade) || profundidade < 1 || profundidade > 10) throw new Error('A profundidade deve estar entre 1 e 10.');
  const fila = montarFila(segmentos, termos);
  const rodada = body.rodada == null ? 1 : Number(body.rodada);
  if (!Number.isInteger(rodada) || rodada < 1 || rodada > fila.length) throw new Error('Rodada nacional inválida.');
  const locais = fila[rodada - 1];
  return {
    locais: locais.join('\n'),
    segmentos: segmentos.join(','),
    profundidade: String(profundidade),
    emails: 'true',
    enriquecer_sites: 'true',
    modo: 'nacional',
    rodada: String(rodada),
    total_rodadas: String(fila.length),
    resumo: locais.join(' · ').slice(0, 180),
  };
}
