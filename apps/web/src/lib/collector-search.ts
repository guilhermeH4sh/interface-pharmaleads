import { corrigirLocal } from "./locations";
import { ESTABLISHMENTS, STATES } from "./prospect-options";

export function buildCollectorSearch(text: string, uf: string, segments: string[], source: string) {
  if (source !== "Google Maps") throw new Error("Esta fonte ainda não está disponível para coleta.");
  if (!segments.length || segments.some(value => !ESTABLISHMENTS.some(option => option.value === value))) {
    throw new Error("Escolha pelo menos um tipo de estabelecimento.");
  }
  if (uf && !STATES.some(option => option.value === uf)) throw new Error("Escolha uma UF válida.");
  let local = text.trim().replace(/\s+/g, " ");
  const suffix = /,\s*([a-z]{2})$/i.exec(local)?.[1]?.toUpperCase();
  if (suffix && uf && suffix !== uf) throw new Error("A UF da pesquisa é diferente da UF selecionada.");
  if (!local) {
    const state = STATES.find(option => option.value === uf);
    if (!state) throw new Error("Digite uma cidade ou bairro, ou escolha uma UF.");
    local = state.label.replace(/ \([A-Z]{2}\)$/, "");
  }
  local = corrigirLocal(local);
  if (uf && !suffix) local = `${local}, ${uf}`;
  if (local.length > 100 || (local.includes("#!#") || [...local].some(char => char.charCodeAt(0) < 32))) throw new Error("Informe um local válido com até 100 caracteres.");
  return { locais: [local], segmentos: [...new Set(segments)], profundidade: 1, emails: false };
}

