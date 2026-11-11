import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { AUTHORIZED_USER_ID, buildDynamicLocations, fetchSupabaseAllLeads, filterLeadItems, mapRawLeadsToItems } from "./backend";
import type { Lead } from "./crm";

beforeEach(() => localStorage.clear());
afterEach(() => vi.unstubAllGlobals());

test("localidade usa o endereço real e não inventa bairro ou UF ausente", () => {
  const rows = [
    { chave: "1", nome: "Farmácia A", local_busca: "São Paulo, SP", endereco: "Rua Um - Centro, Sorocaba - SP", emails: "contato@farmacia.com.br" },
    { chave: "2", nome: "Farmácia B", local_busca: "região desconhecida", endereco: "" },
  ] as Lead[];
  const items = mapRawLeadsToItems(rows);
  expect(items[0]).toMatchObject({ cidade: "Sorocaba", uf: "SP", bairro: "Centro" });
  expect(items[1]).toMatchObject({ uf: "", bairro: "" });
  expect(buildDynamicLocations(items)).toEqual({ SP: { Sorocaba: ["Centro"] } });
  expect(filterLeadItems(items, { uf: "SP", municipio: "Sorocaba", bairro: "Centro", origem: "Google Maps", emailAvailability: "com" })).toHaveLength(1);
  expect(filterLeadItems(items, { uf: "SP", emailAvailability: "sem" })).toHaveLength(0);
});

test("tipo de estabelecimento combina seleções com UF e e-mail antes da paginação", () => {
  const rows = [
    { chave: "1", nome: "Farmácia de bairro", segmento: "varejo", local_busca: "Curitiba, PR", emails: "contato@exemplo.com.br" },
    { chave: "2", nome: "Manipulação", segmento: "manipulacao", local_busca: "Curitiba, PR", emails: "contato@exemplo.com.br" },
    { chave: "3", nome: "Veterinária", segmento: "veterinaria", local_busca: "Curitiba, PR", emails: "" },
    { chave: "4", nome: "Sem segmento", segmento: "", local_busca: "Curitiba, PR", emails: "contato@exemplo.com.br" },
  ] as Lead[];
  const items = mapRawLeadsToItems(rows);
  expect(filterLeadItems(items, { uf: "PR", segmentos: ["varejo", "manipulacao"], emailAvailability: "com" }).map(item => item.id)).toEqual(["1", "2"]);
  expect(filterLeadItems(items, { segmentos: ["veterinaria"], emailAvailability: "com" })).toHaveLength(0);
  expect(filterLeadItems(items, { segmentos: ["varejo"] }).map(item => item.id)).toEqual(["1"]);
});

test("pagina por chave sem repetir linhas quando novas coletas alteram a base", async () => {
  const first = Array.from({ length: 1000 }, (_, index) => ({ chave: String(index).padStart(4, "0"), nome: "Farmácia" }));
  const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
    if (url.includes("/auth/v1/user")) return new Response(JSON.stringify({ id: AUTHORIZED_USER_ID }));
    const query = new URL(url).searchParams;
    if (!query.has("chave")) {
      expect(new Headers(init?.headers).get("Prefer")).toBe("count=exact");
      return new Response(JSON.stringify(first), { headers: { "content-range": "0-999/1001" } });
    }
    expect(query.get("chave")).toBe("gt.0999");
    expect(new Headers(init?.headers).get("Prefer")).toBeNull();
    return new Response(JSON.stringify([{ chave: "1000", nome: "Farmácia nova" }]));
  });
  vi.stubGlobal("fetch", fetcher);
  const result = await fetchSupabaseAllLeads({ access_token: "test", refresh_token: "test", expires_at: Date.now() + 3600000 });
  expect(result.rows).toHaveLength(1001);
  expect(new Set(result.rows.map(row => row.chave)).size).toBe(1001);
});
