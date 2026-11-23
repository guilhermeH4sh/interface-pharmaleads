import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { AUTHORIZED_USER_ID, countRemoteLeads, fetchSupabaseAllLeads, filterLeadItems, mapRawLeadsToItems, readRemoteLeads } from "./backend";
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

test("conta toda a seleção de SP com e-mail quando o Supabase cancela o COUNT", async () => {
  const keys = Array.from({ length: 500 }, (_, index) => ({ chave: String(index).padStart(4, "0") }));
  const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
    const query = new URL(url).searchParams;
    expect(query.get("uf_prospeccao")).toBe("eq.SP");
    expect(query.get("emails")).toBe("like.*@*.*");
    expect(query.get("select")).toBe("chave");
    if (init?.method === "HEAD") return new Response(null, { status: 500 });
    return new Response(JSON.stringify(query.get("chave") === "gt.0499" ? [{ chave: "0500" }] : keys));
  });
  vi.stubGlobal("fetch", fetcher);
  const session = { access_token: "test", refresh_token: "test", expires_at: Date.now() + 3600000 };
  const total = await countRemoteLeads(session, { uf: "SP", emailAvailability: "com", origem: "", segmentos: [], query: "" },
    new AbortController().signal);
  expect(total).toBe(501);
});

test("só a confirmação libera o link de WhatsApp e usa o número verificado", () => {
  const lead = { chave: "a", nome: "Farmácia", telefone: "(12) 3207-0978", whatsapp_link: "https://wa.me/551232070978",
    dados_brutos: { enriquecimento_site: { whatsapp_link: "https://wa.me/5512999990000" } } } as Lead;
  const confirmation = { numero: "5512999990000", estado: "confirmado", verificado_em: "2026-11-22T12:00:00Z" } as const;
  const items = mapRawLeadsToItems([lead, { ...lead, chave: "b", whatsapp_verificacao: confirmation },
    { ...lead, chave: "c", whatsapp_verificacao: { ...confirmation, estado: "indisponivel" } }]);
  expect(items.map(item => item.whatsappLink)).toEqual([undefined, "https://wa.me/5512999990000", undefined]);
  expect(items[0].whatsappPublicado).toBe("5512999990000");
});

test("consulta primeiro as verificações e aplica UF e e-mail apenas às chaves confirmadas", async () => {
  const verification = { numero: "5512999990000", estado: "confirmado", verificado_em: "2026-11-22T12:00:00Z" };
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    const query = new URL(url).searchParams;
    expect(init?.method).not.toBe("HEAD");
    if (query.has("whatsapp_verificacao")) {
      expect(query.has("uf_prospeccao")).toBe(false);
      expect(query.get("order")).toBe("whatsapp_verificacao->>estado.asc,chave.asc");
      return new Response(JSON.stringify([
        { chave: "a", whatsapp_verificacao: verification },
        { chave: "b", whatsapp_verificacao: { ...verification, estado: "indisponivel" } },
      ]));
    }
    expect(query.get("chave")).toBe('in.("a")');
    expect(query.get("uf_prospeccao")).toBe("eq.SP");
    expect(query.get("emails")).toBe("like.*@*.*");
    return new Response(JSON.stringify([{ chave: "a", nome: "Farmácia", emails: "farmacia@example.org",
      whatsapp_verificacao: verification }]));
  }));
  const session = { access_token: "test", refresh_token: "test", expires_at: Date.now() + 3600000 };
  const filters = { uf: "SP", emailAvailability: "com" as const, origem: "", segmentos: [], query: "", whatsappConfirmed: true };
  expect((await readRemoteLeads(session, filters, { limit: 10 })).ids).toEqual(["a"]);
  expect(await countRemoteLeads(session, filters, new AbortController().signal)).toBe(1);
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
