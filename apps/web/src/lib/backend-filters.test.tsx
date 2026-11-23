import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { AUTHORIZED_USER_ID, fetchSupabaseAllLeads, filterLeadItems, mapRawLeadsToItems, readRemoteLeads } from "./backend";
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
  expect(filterLeadItems(items, { uf: "SP", origem: "Google Maps", emailAvailability: "com" })).toHaveLength(1);
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

test("consulta remota filtra e-mails sem regex lenta e preserva leads sem e-mail", async () => {
  const fetcher = vi.fn(async (url: string) => {
    const emailFilter = new URL(url).searchParams.get("emails");
    expect(["like.*@*.*", "eq."]).toContain(emailFilter);
    return new Response(JSON.stringify([{
      chave: emailFilter === "eq." ? "sem" : "com",
      nome: "Farmácia",
      emails: emailFilter === "eq." ? "" : "contato@farmacia.com.br",
      crm_included: false,
    }]));
  });
  vi.stubGlobal("fetch", fetcher);
  const session = { access_token: "test", refresh_token: "test", expires_at: Date.now() + 3600000 };
  const filters = { uf: "", origem: "Todas as origens", segmentos: [], query: "" };
  const withEmail = await readRemoteLeads(session, { ...filters, emailAvailability: "com" }, { limit: 10 });
  const withoutEmail = await readRemoteLeads(session, { ...filters, emailAvailability: "sem" }, { limit: 10 });
  expect(withEmail.items.map(item => item.id)).toEqual(["com"]);
  expect(withoutEmail.items.map(item => item.id)).toEqual(["sem"]);
  expect(fetcher).toHaveBeenCalledTimes(2);
});

test("pagina por chave sem repetir linhas quando novas coletas alteram a base", async () => {
  const first = Array.from({ length: 500 }, (_, index) => ({ chave: String(index).padStart(4, "0"), nome: "Farmácia" }));
  const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
    if (url.includes("/auth/v1/user")) return new Response(JSON.stringify({ id: AUTHORIZED_USER_ID }));
    const query = new URL(url).searchParams;
    if (!query.has("chave")) {
      expect(new Headers(init?.headers).get("Prefer")).toBeNull();
      expect(query.get("limit")).toBe("500");
      return new Response(JSON.stringify(first));
    }
    expect(query.get("chave")).toBe("gt.0499");
    expect(new Headers(init?.headers).get("Prefer")).toBeNull();
    return new Response(JSON.stringify([{ chave: "1000", nome: "Farmácia nova" }]));
  });
  vi.stubGlobal("fetch", fetcher);
  const result = await fetchSupabaseAllLeads({ access_token: "test", refresh_token: "test", expires_at: Date.now() + 3600000 });
  expect(result.rows).toHaveLength(501);
  expect(new Set(result.rows.map(row => row.chave)).size).toBe(501);
});

test("reduz a página após o timeout do Supabase e preserva a origem da Receita", async () => {
  const fetcher = vi.fn(async (url: string) => {
    if (url.includes("/auth/v1/user")) return new Response(JSON.stringify({ id: AUTHORIZED_USER_ID }));
    const query = new URL(url).searchParams;
    if (query.get("limit") === "500") return new Response('{"code":"57014"}', { status: 500 });
    expect(query.get("limit")).toBe("250");
    expect(query.get("chave")).toBeNull();
    expect(query.get("select")).toContain("fonte_dados:dados_brutos->>fonte_dados");
    return new Response(JSON.stringify([{ chave: "receita:1", fonte_dados: "Receita Federal", cnpj: "12345678000195" }]));
  });
  vi.stubGlobal("fetch", fetcher);
  const result = await fetchSupabaseAllLeads({ access_token: "test", refresh_token: "test", expires_at: Date.now() + 3600000 });
  expect(result.rows[0].dados_brutos).toMatchObject({ fonte_dados: "Receita Federal", cnpj: "12345678000195" });
  expect(fetcher).toHaveBeenCalledTimes(3);
});
