import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { RemoteReports } from "./RemoteReports";
import { AUTHORIZED_USER_ID, computeSummaryFromItems, fetchCrmCandidates, fetchSupabaseAllLeads } from "../../lib/backend";

const session = { access_token: "test", refresh_token: "test", expires_at: 4102444800000 };
beforeEach(() => { localStorage.clear(); sessionStorage.clear(); });
afterEach(() => vi.unstubAllGlobals());

test("relatórios usam uma agregação sem baixar a carteira ao abrir", async () => {
  const fetcher = vi.fn(async (url: string) => {
    expect(url).toContain("/rpc/pharmaleads_relatorio");
    return new Response(JSON.stringify({ summary: { ...computeSummaryFromItems([]), totalLeads: 100000, estados: 27 },
      phoneCount: 50000, whatsappCount: 25, segments: { varejo: 100000, manipulacao: 0, homeopatia: 0, outros: 0 } }));
  });
  vi.stubGlobal("fetch", fetcher);
  render(<RemoteReports session={session} version={0} onSessionInvalid={vi.fn()} />);
  expect(await screen.findByText("50% com telefone registrado")).toBeInTheDocument();
  expect(screen.getByText("25")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Exportar Base Completa (CSV)" })).toBeEnabled();
  expect(fetcher).toHaveBeenCalledTimes(1);
});

test("migração ausente mostra erro e retry, sem simular base vazia ou buscar todos os leads", async () => {
  const fetcher = vi.fn(async () => new Response("{}", { status: 404 }));
  vi.stubGlobal("fetch", fetcher);
  render(<RemoteReports session={session} version={0} onSessionInvalid={vi.fn()} />);
  expect(await screen.findByRole("alert")).toHaveTextContent("12_relatorios_agregados.sql");
  expect(screen.getByRole("button", { name: "Tentar novamente" })).toBeEnabled();
  expect(screen.queryByText("Total de Farmácias")).not.toBeInTheDocument();
  expect(fetcher).toHaveBeenCalledTimes(1);
});

test("carregamento do Kanban consulta apenas membros do CRM", async () => {
  const fetcher = vi.fn(async (url: string) => {
    if (url.includes("/auth/v1/user")) return new Response(JSON.stringify({ id: AUTHORIZED_USER_ID }));
    const query = new URL(url).searchParams;
    expect(query.get("or")).toBe("(crm_included.eq.true,and(crm_included.is.null,crm_status.neq.Não contatado))");
    return new Response("[]");
  });
  vi.stubGlobal("fetch", fetcher);
  expect((await fetchSupabaseAllLeads(session, { crmOnly: true })).rows).toEqual([]);
  expect(fetcher).toHaveBeenCalledTimes(2);
});

test("candidatos são limitados e pesquisados por nome ou local no servidor", async () => {
  const fetcher = vi.fn(async (url: string) => {
    const query = new URL(url).searchParams;
    expect(query.get("limit")).toBe("31");
    expect(query.get("or")).toContain("crm_included.eq.false");
    expect(query.get("and")).toContain("local_busca.ilike");
    expect(query.get("and")).toContain("SP");
    return new Response(JSON.stringify([{ chave: "1", nome: "Farmácia Centro", local_busca: "São Paulo, SP" }]));
  });
  vi.stubGlobal("fetch", fetcher);
  expect((await fetchCrmCandidates(session, "SP", new AbortController().signal))[0].id).toBe("1");
  expect(fetcher).toHaveBeenCalledTimes(1);
});
