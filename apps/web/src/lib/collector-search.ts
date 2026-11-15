import { ESTABLISHMENTS, STATES } from "./prospect-options";

function normalizeState(text: string) {
  return text.normalize("NFD").replace(/\p{Diacritic}/gu, "").trim().replace(/\s+/g, " ").toLowerCase();
}

export function findCollectorState(text: string) {
  const name = normalizeState(text);
  return STATES.find(state => [state.value, state.label, state.label.slice(0, -5)].some(value => normalizeState(value) === name));
}

export function buildCollectorSearch(text: string, uf: string, segments: string[], source: string) {
  if (source !== "Google Maps") throw new Error("Esta fonte ainda não está disponível para coleta.");
  if (!segments.length || segments.some(value => !ESTABLISHMENTS.some(option => option.value === value))) {
    throw new Error("Escolha pelo menos um tipo de estabelecimento.");
  }
  const selected = STATES.find(state => state.value === uf);
  if (uf && !selected) throw new Error("Escolha uma UF válida.");
  const typed = text.trim() ? findCollectorState(text) : undefined;
  if (text.trim() && !typed) throw new Error("Digite o nome ou a sigla de um estado.");
  if (typed && selected && typed.value !== selected.value) {
    throw new Error("A UF da pesquisa é diferente da UF selecionada.");
  }
  const state = typed ?? selected;
  const options = { segmentos: [...new Set(segments)], profundidade: 1, emails: true };
  if (!state) return { ...options, locais: [] as string[], cobertura: "nacional" as const };
  return { ...options, cobertura: undefined, locais: [`${state.label.slice(0, -5)}, ${state.value}`] };
}
