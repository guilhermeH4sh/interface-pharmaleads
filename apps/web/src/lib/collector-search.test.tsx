import { expect, test } from "vitest";
import { buildCollectorSearch } from "./collector-search";

test("combina local e UF, corrige cidade e não duplica a sigla", () => {
  expect(buildCollectorSearch("sao pauli", "", ["varejo"], "Google Maps").locais).toEqual(["São Paulo"]);
  expect(buildCollectorSearch("sao pauli", "SP", ["varejo"], "Google Maps").locais).toEqual(["São Paulo, SP"]);
  expect(buildCollectorSearch("Curitiba, PR", "PR", ["varejo"], "Google Maps").locais).toEqual(["Curitiba, PR"]);
  expect(buildCollectorSearch("", "AC", ["varejo"], "Google Maps").locais).toEqual(["Acre, AC"]);
});
test("rejeita UFs conflitantes e fontes não disponíveis", () => {
  expect(() => buildCollectorSearch("Curitiba, PR", "SP", ["varejo"], "Google Maps")).toThrow("diferente");
  expect(() => buildCollectorSearch("Curitiba", "PR", ["varejo"], "Receita Federal")).toThrow("não está disponível");
  expect(() => buildCollectorSearch("Curitiba", "PR", [], "Google Maps")).toThrow("pelo menos um tipo");
});


test("Todas as UFs sem local inicia cobertura nacional; com cidade mantém busca avulsa", () => {
  expect(buildCollectorSearch("  ", "", ["varejo", "manipulacao"], "Google Maps")).toMatchObject({ cobertura: "nacional", segmentos: ["varejo", "manipulacao"], profundidade: 1, emails: true });
  expect(buildCollectorSearch("Curitiba", "", ["varejo"], "Google Maps").cobertura).toBeUndefined();
  expect(buildCollectorSearch("", "SP", ["varejo"], "Google Maps").cobertura).toBeUndefined();
});
