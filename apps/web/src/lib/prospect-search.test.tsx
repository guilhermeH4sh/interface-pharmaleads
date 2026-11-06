import { afterEach, expect, test, vi } from "vitest";
import { buildProspectQuery, emptyProspectFilters, searchSupabaseProspects } from "./prospect-search";

afterEach(() => vi.unstubAllGlobals());

test("filtros vazios consultam todos e a paginação é feita no servidor", () => {
  const query = buildProspectQuery(emptyProspectFilters(), 2);
  expect(query.get("limit")).toBe("25");
  expect(query.get("offset")).toBe("25");
  expect(query.has("segmento")).toBe(false);
  expect(query.has("crm_status")).toBe(false);
  expect(query.has("or")).toBe(false);
});

test("combina grupos por AND e múltiplos valores por OR", () => {
  const query = buildProspectQuery({ segments: ["varejo", "manipulacao"], states: ["SP", "RJ"], sources: ["Google Maps", "Receita Federal"], statuses: ["Qualificado", "Em contato"] }, 1);
  expect(query.get("segmento")).toBe("in.(varejo,manipulacao)");
  expect(query.get("or")).toBe('(local_busca.ilike."*, SP",local_busca.ilike."*, RJ")');
  expect(query.get("crm_status")).toBe('in.("Qualificado","Em contato")');
  expect(query.has("chave")).toBe(false);
});

test("não atribui registros a fontes sem integração nem aceita filtros arbitrários", () => {
  expect(buildProspectQuery({ ...emptyProspectFilters(), sources: ["Receita Federal"] }, 1).get("chave")).toBe("is.null");
  expect(() => buildProspectQuery({ ...emptyProspectFilters(), states: ["XX"] }, 1)).toThrow("Filtro de pesquisa inválido");
});

test("usa autenticação existente, pede contagem exata e preserva contatos completos", async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify([{ chave: "1", telefone: "+55 11 99999-1234", emails: "contato@exemplo.com.br" }]), { headers: { "content-range": "25-25/26" } }));
  vi.stubGlobal("fetch", fetcher);
  const session = { access_token: "jwt-de-teste", refresh_token: "refresh", expires_at: Date.now() + 3600000 };
  const result = await searchSupabaseProspects(session, emptyProspectFilters(), 2);
  expect(result.total).toBe(26);
  expect(result.rows[0].telefone).toBe("+55 11 99999-1234");
  expect(result.rows[0].emails).toBe("contato@exemplo.com.br");
  expect(new URL(fetcher.mock.calls[0][0]).searchParams.get("offset")).toBe("25");
  expect(fetcher.mock.calls[0][1].headers).toMatchObject({ Authorization: "Bearer jwt-de-teste", Prefer: "count=exact" });
});

test("apresenta falha quando a consulta é recusada", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 403 })));
  await expect(searchSupabaseProspects({ access_token: "test", refresh_token: "test", expires_at: Date.now() + 3600000 }, emptyProspectFilters(), 1)).rejects.toThrow("HTTP 403");
});
