import { expect, test } from "vitest";
import { buildCollectorSearch } from "./collector-search";

test("combina local e UF, corrige cidade e não duplica a sigla", () => {
  expect(buildCollectorSearch("sao pauli", "SP", ["varejo"], "Google Maps").locais).toEqual(["São Paulo, SP"]);
  expect(buildCollectorSearch("Curitiba, PR", "PR", ["varejo"], "Google Maps").locais).toEqual(["Curitiba, PR"]);
  expect(buildCollectorSearch("", "AC", ["varejo"], "Google Maps").locais).toEqual(["Acre, AC"]);
});
test("rejeita local vazio, UFs conflitantes e fontes não disponíveis", () => {
  expect(() => buildCollectorSearch("", "", ["varejo"], "Google Maps")).toThrow("Digite uma cidade");
  expect(() => buildCollectorSearch("Curitiba, PR", "SP", ["varejo"], "Google Maps")).toThrow("diferente");
  expect(() => buildCollectorSearch("Curitiba", "PR", ["varejo"], "Receita Federal")).toThrow("não está disponível");
  expect(() => buildCollectorSearch("Curitiba", "PR", [], "Google Maps")).toThrow("pelo menos um tipo");
});
