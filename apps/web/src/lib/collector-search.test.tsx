import { expect, test } from "vitest";
import { buildCollectorSearch } from "./collector-search";
import { STATES } from "./prospect-options";

test.each(STATES)("gera a mesma busca por nome ou sigla para $label", ({ value, label }) => {
  const local = `${label.slice(0, -5)}, ${value}`;
  expect(buildCollectorSearch(label, "", ["varejo"], "Google Maps").locais).toEqual([local]);
  expect(buildCollectorSearch(value.toLowerCase(), "", ["varejo"], "Google Maps").locais).toEqual([local]);
  expect(buildCollectorSearch("", value, ["varejo"], "Google Maps").locais).toEqual([local]);
});

test("normaliza acentos e rejeita municípios, UFs conflitantes e fontes indisponíveis", () => {
  expect(buildCollectorSearch(" sao paulo ", "", ["varejo"], "Google Maps").locais).toEqual(["São Paulo, SP"]);
  expect(() => buildCollectorSearch("Curitiba", "", ["varejo"], "Google Maps")).toThrow("nome ou a sigla de um estado");
  expect(() => buildCollectorSearch("PR", "SP", ["varejo"], "Google Maps")).toThrow("diferente");
  expect(() => buildCollectorSearch("PR", "", ["varejo"], "Receita Federal")).toThrow("não está disponível");
  expect(() => buildCollectorSearch("PR", "", [], "Google Maps")).toThrow("pelo menos um tipo");
});

test("Todas as UFs com a barra vazia inicia a cobertura nacional", () => {
  expect(buildCollectorSearch("  ", "", ["varejo", "manipulacao"], "Google Maps")).toMatchObject({ cobertura: "nacional", segmentos: ["varejo", "manipulacao"], profundidade: 1, emails: true });
  expect(buildCollectorSearch("", "SP", ["varejo"], "Google Maps").cobertura).toBeUndefined();
});
