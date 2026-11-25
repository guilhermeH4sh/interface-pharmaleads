import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { PlatformDashboard } from "./App";
import { AUTHORIZED_USER_ID, SESSION_KEY, savedSupabaseSession } from "./lib/backend";

function TestDashboard() {
  return <PlatformDashboard initialSession={savedSupabaseSession() || { access_token: "test", refresh_token: "test", expires_at: 4102444800000 }} onSignOut={vi.fn()} />;
}

async function showSavedLeads(region = "Todas as UFs") {
  await userEvent.click(screen.getByRole("combobox", { name: "UF" }));
  await userEvent.click(screen.getByRole("option", { name: region.match(/\(([A-Z]{2})\)$/)?.[1] ?? region }));
  await userEvent.click(screen.getByRole("button", { name: "Aplicar filtros" }));
}

beforeEach(() => { window.localStorage.clear(); window.sessionStorage.clear(); window.history.replaceState(null, "", "/"); });
afterEach(() => vi.unstubAllGlobals());

test("Leads exige escolha explícita e pagina todos os resultados salvos", async () => {
  const rows = Array.from({ length: 55 }, (_, i) => ({
    chave: String(i).padStart(2, "0"), nome: "Farmácia " + i, uf_prospeccao: "PR", crm_included: false,
  }));
  const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
    if (url.includes("/rpc/leads_resumo")) {
      return new Response(JSON.stringify([{ totalLeads: 105789, qualificados: 10, emContato: 2, estados: 27 }]));
    }
    if (url.includes("/rest/v1/pharmaleads")) {
      const p = new URL(url).searchParams;
      if (init?.method === "HEAD") return new Response(null, { headers: { "content-range": "0-0/55" } });
      const after = p.get("chave")?.slice(3) ?? "";
      return new Response(JSON.stringify(rows.filter(row => row.chave > after).slice(0, Number(p.get("limit")))));
    }
    return new Response(JSON.stringify({ run: null }));
  });
  vi.stubGlobal("fetch", fetcher);
  render(<TestDashboard />);
  expect(screen.queryByRole("table")).not.toBeInTheDocument();
  expect(fetcher.mock.calls.some(([url]) => url.includes("/rest/v1/pharmaleads"))).toBe(false);
  await showSavedLeads();
  expect(screen.getByRole("button", { name: "Leads" })).toHaveAttribute("aria-current", "page");
  expect(screen.queryByRole("button", { name: /^Prospecção$/ })).not.toBeInTheDocument();
  expect(await screen.findByText("105.789")).toBeInTheDocument();
  expect(await screen.findByRole("button", { name: "Farmácia 0" })).toBeInTheDocument();
  for (let page = 2; page <= 6; page++) {
    await userEvent.click(screen.getByRole("button", { name: "Próxima página" }));
    expect(await screen.findByRole("button", { name: "Farmácia " + (page - 1) * 10 })).toBeInTheDocument();
  }
  expect(screen.getByRole("button", { name: "Próxima página" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Farmácia 50" })).toBeInTheDocument();
});

test("pesquisa filtra o catálogo por UF sem chamar o coletor", async () => {
  const fetcher = vi.fn(async (url: string) => {
    if (url.includes("/rest/v1/pharmaleads")) {
      expect(new URL(url).searchParams.get("uf_prospeccao")).toBe("eq.PR");
      return new Response(JSON.stringify([{ chave: "pr", nome: "Farmácia do Paraná", uf_prospeccao: "PR" }]),
        { headers: { "content-range": "0-0/1" } });
    }
    if (url.includes("/rpc/leads_resumo")) return new Response(JSON.stringify([{ totalLeads: 1 }]));
    throw new Error(`Chamada inesperada: ${url}`);
  });
  vi.stubGlobal("fetch", fetcher);
  render(<TestDashboard />);
  expect(screen.queryByRole("combobox", { name: "Estado da pesquisa" })).not.toBeInTheDocument();
  expect(screen.queryByRole("combobox", { name: "Tipo de estabelecimento da pesquisa" })).not.toBeInTheDocument();
  await showSavedLeads("Paraná (PR)");
  expect(await screen.findByRole("button", { name: "Farmácia do Paraná" })).toBeInTheDocument();
  expect(fetcher.mock.calls.some(([url]) => url.includes("/api/collector"))).toBe(false);
  expect(screen.queryByRole("button", { name: "Parar coleta" })).not.toBeInTheDocument();
});

test("configurações mostram apenas Supabase e preservam a conexão existente", async () => {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({ access_token: "test", refresh_token: "test", expires_at: Date.now() + 3600000 }));
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ run: null }))));
  render(<TestDashboard />);
  await showSavedLeads();
  await userEvent.click(screen.getByRole("button", { name: "Configurações" }));
  expect(screen.getByRole("status")).toHaveTextContent("Supabase conectado");
  expect(screen.queryByRole("textbox", { name: /E-mail/ })).not.toBeInTheDocument();
  expect(screen.queryByText("SQLite Local + Gosom")).not.toBeInTheDocument();
  expect(screen.queryByText("Modo Demonstração (Mock)")).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Encerrar Sessão" })).not.toBeInTheDocument();
  expect(localStorage.getItem(SESSION_KEY)).toContain("refresh_token");
});


test("Nova pesquisa abre modal e confirma a busca na própria aba", async () => {
  const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
    if (url.includes("/rest/v1/")) return new Response("[]");
    return new Response(JSON.stringify({ run: init?.method === "POST" ? { id: "1", status: "queued" } : null }));
  });
  vi.stubGlobal("fetch", fetcher);
  render(<TestDashboard />);
  await showSavedLeads();
  await userEvent.click(screen.getByRole("button", { name: "Nova pesquisa" }));
  const modal = screen.getByRole("dialog", { name: "Nova pesquisa" });
  await userEvent.click(within(modal).getByRole("combobox", { name: "UF" }));
  await userEvent.click(screen.getByRole("option", { name: "Paraná (PR)" }));
  await userEvent.click(within(modal).getByRole("button", { name: "Pesquisar leads" }));
  await waitFor(() => expect(screen.queryByRole("dialog", { name: "Nova pesquisa" })).not.toBeInTheDocument());
  expect(fetcher.mock.calls.some(([url]) => url === "/api/collector")).toBe(false);
  expect(screen.getByRole("heading", { name: "Leads – Farmácias" })).toBeInTheDocument();
});

test("adiciona lead real ao CRM e mantém o vínculo ao voltar à aba", async () => {
  localStorage.setItem(SESSION_KEY, JSON.stringify({ access_token: "test", refresh_token: "test", expires_at: Date.now() + 3600000 }));
  let included = false;
  let status = "Não contatado";
  const lead = () => ({ chave: "real-1", nome: "Farmácia da base", local_busca: "Curitiba, PR", segmento: "varejo", crm_included: included, crm_status: status });
  const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
    if (url.includes("/auth/v1/user")) return new Response(JSON.stringify({ id: AUTHORIZED_USER_ID }));
    if (url.includes("/rest/v1/pharmaleads")) {
      if (init?.method === "PATCH") {
        const patch = JSON.parse(String(init.body));
        expect(typeof patch.crm_included).toBe("boolean");
        included = patch.crm_included;
        status = patch.crm_status;
      }
      return new Response(JSON.stringify([lead()]), { headers: { "content-range": "0-0/1" } });
    }
    return new Response(JSON.stringify({ run: null }));
  });
  vi.stubGlobal("fetch", fetcher);
  render(<TestDashboard />);
  await showSavedLeads();
  await userEvent.click(screen.getByRole("button", { name: "CRM" }));
  await userEvent.click(screen.getByRole("button", { name: "Adicionar leads" }));
  const add = await screen.findByRole("button", { name: "Adicionar Farmácia da base ao CRM" });
  await userEvent.click(add);
  await waitFor(() => expect(screen.queryByRole("button", { name: "Adicionar Farmácia da base ao CRM" })).not.toBeInTheDocument());
  expect(included).toBe(true);
  expect(status).toBe("Em contato");
  await userEvent.keyboard("{Escape}");
  expect(screen.getByText("Farmácia da base")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Leads" }));
  await showSavedLeads();
  expect(await screen.findByRole("button", { name: "Farmácia da base" })).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "CRM" }));
  expect(await screen.findByText("Farmácia da base")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Remover Farmácia da base do CRM" }));
  await waitFor(() => expect(screen.queryByText("Farmácia da base")).not.toBeInTheDocument());
  expect(included).toBe(false);
  expect(status).toBe("Não contatado");
  await userEvent.click(screen.getByRole("button", { name: "Leads" }));
  await showSavedLeads();
  expect(await screen.findByRole("button", { name: "Farmácia da base" })).toBeInTheDocument();
});

test("Leads não expõe status e a ação Adicionar ao CRM move o contato", async () => {
  localStorage.setItem(SESSION_KEY, JSON.stringify({ access_token: "test", refresh_token: "test", expires_at: Date.now() + 3600000 }));
  let included = false;
  let status = "Não contatado";
  const lead = () => ({ chave: "real-2", nome: "Farmácia em negociação", local_busca: "São Paulo, SP", segmento: "varejo", crm_included: included, crm_status: status });
  const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
    if (url.includes("/auth/v1/user")) return new Response(JSON.stringify({ id: AUTHORIZED_USER_ID }));
    if (url.includes("/rest/v1/pharmaleads")) {
      if (init?.method === "PATCH") {
        expect(JSON.parse(String(init.body))).toEqual({ crm_status: "Em contato", crm_included: true });
        included = true;
        status = "Em contato";
      }
      return new Response(JSON.stringify([lead()]), { headers: { "content-range": "0-0/1" } });
    }
    return new Response(JSON.stringify({ run: null }));
  });
  vi.stubGlobal("fetch", fetcher);
  render(<TestDashboard />);
  await showSavedLeads();
  await userEvent.click(screen.getByRole("button", { name: "Leads" }));
  await showSavedLeads();
  expect(screen.getAllByRole("columnheader").map(header => header.textContent?.trim())).not.toContain("Status");
  expect(screen.queryByRole("combobox", { name: "Status" })).not.toBeInTheDocument();
  await userEvent.click(await screen.findByRole("button", { name: "Farmácia em negociação" }));
  await userEvent.click(screen.getByRole("button", { name: "Adicionar ao CRM" }));
  expect(await screen.findByRole("button", { name: "Farmácia em negociação" })).toBeInTheDocument();
  expect(included).toBe(true);
  await userEvent.click(screen.getByRole("button", { name: "CRM" }));
  expect(await screen.findByText("Farmácia em negociação")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Leads" }));
  await showSavedLeads();
  expect(await screen.findByRole("button", { name: "Farmácia em negociação" })).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "CRM" }));
  expect(screen.getByRole("heading", { name: "CRM" })).toBeInTheDocument();
  expect(screen.getByText("Farmácia em negociação")).toBeInTheDocument();
  expect(screen.queryByRole("searchbox", { name: "Pesquisar no CRM" })).not.toBeInTheDocument();
});

test("CRM reutiliza apenas os contatos ativos e a aba Leads consulta só uma página", async () => {
  localStorage.setItem(SESSION_KEY, JSON.stringify({ access_token: "test", refresh_token: "test", expires_at: Date.now() + 3600000 }));
  const rows = [
    { chave: "crm-pr", nome: "Farmácia Paraná", local_busca: "Curitiba, PR", endereco: "Rua A - Centro, Curitiba - PR", segmento: "varejo", emails: "contato@parana.com.br", crm_included: true, crm_status: "Em contato" },
    { chave: "crm-sp", nome: "Farmácia Paulista", local_busca: "São Paulo, SP", endereco: "Rua B - Pinheiros, São Paulo - SP", segmento: "varejo", emails: "", crm_included: true, crm_status: "Respondido" },
  ];
  const fetcher = vi.fn(async (url: string) => {
    if (url.includes("/auth/v1/user")) return new Response(JSON.stringify({ id: AUTHORIZED_USER_ID }));
    if (url.includes("/rest/v1/pharmaleads")) return new Response(JSON.stringify(rows), { headers: { "content-range": "0-1/2" } });
    return new Response(JSON.stringify({ run: null }));
  });
  vi.stubGlobal("fetch", fetcher);
  render(<TestDashboard />);
  await showSavedLeads();
  await userEvent.click(screen.getByRole("button", { name: "CRM" }));
  expect(await screen.findByText("Farmácia Paraná")).toBeInTheDocument();
  expect(screen.getByText("Farmácia Paulista")).toBeInTheDocument();
  expect(screen.queryByRole("searchbox", { name: "Pesquisar no CRM" })).not.toBeInTheDocument();
  expect(screen.queryByText("Filtros", { exact: true })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Aplicar filtros" })).not.toBeInTheDocument();
  const reads = fetcher.mock.calls.map(([url]) => String(url)).filter(url =>
    url.includes("/rest/v1/pharmaleads") && new URL(url).searchParams.get("or")?.includes("crm_included.eq.true")).length;
  await userEvent.click(screen.getByRole("button", { name: "Leads" }));
  await showSavedLeads();
  await userEvent.click(screen.getByRole("button", { name: "CRM" }));
  expect(screen.getByText("Farmácia Paulista")).toBeInTheDocument();
  const queries = fetcher.mock.calls.map(([url]) => String(url)).filter(url => url.includes("/rest/v1/pharmaleads"));
  const paginated = queries.filter(url => new URL(url).searchParams.get("limit") === "11");
  expect(paginated).toHaveLength(2);
  expect(new URL(paginated[0]).searchParams.get("limit")).toBe("11");
  expect(queries.filter(url => !paginated.includes(url))).toHaveLength(reads);
});

test("CRM oferece Não qualificado, persiste o status e não mostra Não contatado", async () => {
  localStorage.setItem(SESSION_KEY, JSON.stringify({ access_token: "test", refresh_token: "test", expires_at: Date.now() + 3600000 }));
  let status = "Em contato";
  const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
    if (url.includes("/auth/v1/user")) return new Response(JSON.stringify({ id: AUTHORIZED_USER_ID }));
    if (url.includes("/rest/v1/pharmaleads")) {
      if (init?.method === "PATCH") {
        expect(JSON.parse(String(init.body))).toEqual({ crm_status: "Não qualificado", crm_included: true });
        status = "Não qualificado";
      }
      return new Response(JSON.stringify([{ chave: "crm-nq", nome: "Farmácia analisada", local_busca: "Recife, PE", segmento: "varejo", crm_included: true, crm_status: status }]), { headers: { "content-range": "0-0/1" } });
    }
    return new Response(JSON.stringify({ run: null }));
  });
  vi.stubGlobal("fetch", fetcher);
  render(<TestDashboard />);
  await showSavedLeads();
  await userEvent.click(screen.getByRole("button", { name: "CRM" }));
  await userEvent.click(await screen.findByText("Farmácia analisada"));
  const dialog = screen.getByRole("dialog");
  expect(within(dialog).queryByRole("button", { name: "Não contatado" })).not.toBeInTheDocument();
  await userEvent.click(within(dialog).getByRole("button", { name: "Não qualificado" }));
  await waitFor(() => expect(status).toBe("Não qualificado"));
  await userEvent.click(within(dialog).getByText("Fechar"));
  expect(within(screen.getByLabelText("Coluna Não Qualificado")).getByText("Farmácia analisada")).toBeInTheDocument();
  expect(screen.queryByLabelText("Coluna Não Contatado")).not.toBeInTheDocument();
});

test("falha ao adicionar ao CRM mantém o lead em Leads", async () => {
  localStorage.setItem(SESSION_KEY, JSON.stringify({ access_token: "test", refresh_token: "test", expires_at: Date.now() + 3600000 }));
  const lead = { chave: "real-3", nome: "Farmácia sem atualização", local_busca: "Curitiba, PR", segmento: "varejo", crm_included: false, crm_status: "Não contatado" };
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    if (url.includes("/auth/v1/user")) return new Response(JSON.stringify({ id: AUTHORIZED_USER_ID }));
    if (url.includes("/rest/v1/pharmaleads")) {
      if (init?.method === "PATCH") return new Response(JSON.stringify({ message: "Sem permissão para atualizar" }), { status: 403 });
      return new Response(JSON.stringify([lead]), { headers: { "content-range": "0-0/1" } });
    }
    return new Response(JSON.stringify({ run: null }));
  }));
  render(<TestDashboard />);
  await showSavedLeads();
  await userEvent.click(screen.getByRole("button", { name: "Leads" }));
  await showSavedLeads();
  await userEvent.click(await screen.findByRole("button", { name: "Farmácia sem atualização" }));
  await userEvent.click(screen.getByRole("button", { name: "Adicionar ao CRM" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Sem permissão para atualizar");
  expect(screen.getByRole("button", { name: "Farmácia sem atualização" })).toBeInTheDocument();
});

test("Leads mostra o e-mail sem responsável e filtra com ou sem endereço válido", async () => {
  localStorage.setItem(SESSION_KEY, JSON.stringify({ access_token: "test", refresh_token: "test", expires_at: Date.now() + 3600000 }));
  const rows = [
    { chave: "email-1", nome: "Farmácia com e-mail", local_busca: "Curitiba, PR", segmento: "varejo", emails: "contato@farmacia.com.br; vendas@farmacia.com.br", crm_included: false },
    { chave: "email-2", nome: "Farmácia sem e-mail", local_busca: "Curitiba, PR", segmento: "varejo", emails: "não informado", crm_included: false },
  ];
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    if (url.includes("/auth/v1/user")) return new Response(JSON.stringify({ id: AUTHORIZED_USER_ID }));
    if (url.includes("/rest/v1/pharmaleads")) return new Response(JSON.stringify(rows), { headers: { "content-range": "0-1/2" } });
    return new Response(JSON.stringify({ run: null }));
  }));
  render(<TestDashboard />);
  await showSavedLeads();
  await userEvent.click(screen.getByRole("button", { name: "Leads" }));
  await showSavedLeads();
  expect(await within(screen.getByRole("table")).findByRole("link", { name: "contato@farmacia.com.br" })).toHaveAttribute("href", "mailto:contato@farmacia.com.br");
  const headers = screen.getAllByRole("columnheader").map((header) => header.textContent?.trim());
  expect(headers).toContain("E-mail");
  expect(headers).not.toContain("Responsável");

  await userEvent.click(screen.getByRole("combobox", { name: "E-mail" }));
  await userEvent.click(screen.getByRole("option", { name: "Com e-mail" }));
  await userEvent.click(screen.getByRole("button", { name: "Aplicar filtros" }));
  expect(screen.getByRole("button", { name: "Farmácia com e-mail" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Farmácia sem e-mail" })).not.toBeInTheDocument();

  await userEvent.click(screen.getByRole("combobox", { name: "E-mail" }));
  await userEvent.click(screen.getByRole("option", { name: "Sem e-mail" }));
  await userEvent.click(screen.getByRole("button", { name: "Aplicar filtros" }));
  expect(screen.getByRole("button", { name: "Farmácia sem e-mail" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Farmácia com e-mail" })).not.toBeInTheDocument();
});


test("CRM aplica atualização otimista imediata, não refaz fetch completo e reverte com toast se falhar", async () => {
  localStorage.setItem(SESSION_KEY, JSON.stringify({ access_token: "test", refresh_token: "test", expires_at: Date.now() + 3600000 }));
  const row = { chave: "opt-1", nome: "Farmácia Otimista", local_busca: "Teresina, PI", segmento: "varejo", crm_included: true, crm_status: "Em contato" };
  let resolvePatch!: (value: Response) => void;
  let patchCalls = 0;
  let listReads = 0;

  const fetcher = vi.fn((url: string, init?: RequestInit) => {
    if (url.includes("/auth/v1/user")) return Promise.resolve(new Response(JSON.stringify({ id: AUTHORIZED_USER_ID })));
    if (url.includes("/rest/v1/pharmaleads") && init?.method === "PATCH") {
      patchCalls += 1;
      return new Promise<Response>((resolve) => {
        resolvePatch = resolve;
      });
    }
    if (url.includes("/rest/v1/pharmaleads")) {
      if (new URL(url).searchParams.get("or")?.includes("crm_included.eq.true")) listReads += 1;
      return Promise.resolve(new Response(JSON.stringify([row]), { headers: { "content-range": "0-0/1" } }));
    }
    return Promise.resolve(new Response(JSON.stringify({ run: null })));
  });
  vi.stubGlobal("fetch", fetcher);

  render(<TestDashboard />);
  await showSavedLeads();
  await userEvent.click(screen.getByRole("button", { name: "CRM" }));
  expect(await screen.findByText("Farmácia Otimista")).toBeInTheDocument();
  expect(listReads).toBe(1);

  // Clica em "Avançar etapa" — a UI deve mover IMEDIATAMENTE antes da resposta do PATCH
  await userEvent.click(screen.getByRole("button", { name: /Avançar etapa/ }));
  expect(within(screen.getByLabelText("Coluna Respondido")).getByText("Farmácia Otimista")).toBeInTheDocument();
  expect(within(screen.getByLabelText("Coluna Em Contato")).queryByText("Farmácia Otimista")).not.toBeInTheDocument();
  expect(patchCalls).toBe(1);

  // Simula falha do Supabase -> card volta para "Em Contato" e toast exibe erro
  resolvePatch(new Response(JSON.stringify({ message: "Falha de permissão no banco" }), { status: 403 }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Falha de permissão no banco");
  expect(within(screen.getByLabelText("Coluna Em Contato")).getByText("Farmácia Otimista")).toBeInTheDocument();

  // Novo avanço com sucesso -> não dispara refetch completo da lista (listReads continua 1)
  await userEvent.click(screen.getByRole("button", { name: /Avançar etapa/ }));
  expect(within(screen.getByLabelText("Coluna Respondido")).getByText("Farmácia Otimista")).toBeInTheDocument();
  resolvePatch(new Response(JSON.stringify([{ ...row, crm_status: "Respondido" }]), { status: 200 }));
  await waitFor(() => expect(listReads).toBe(1));
  expect(within(screen.getByLabelText("Coluna Respondido")).getByText("Farmácia Otimista")).toBeInTheDocument();
});

test("CRM protege contra race condition em movimentos rápidos consecutivos", async () => {
  localStorage.setItem(SESSION_KEY, JSON.stringify({ access_token: "test", refresh_token: "test", expires_at: Date.now() + 3600000 }));
  const row = { chave: "race-1", nome: "Farmácia Veloz", local_busca: "São Paulo, SP", segmento: "varejo", crm_included: true, crm_status: "Em contato" };
  const patchResolvers: Array<(value: Response) => void> = [];

  const fetcher = vi.fn((url: string, init?: RequestInit) => {
    if (url.includes("/auth/v1/user")) return Promise.resolve(new Response(JSON.stringify({ id: AUTHORIZED_USER_ID })));
    if (url.includes("/rest/v1/pharmaleads") && init?.method === "PATCH") {
      return new Promise<Response>((resolve) => {
        patchResolvers.push(resolve);
      });
    }
    if (url.includes("/rest/v1/pharmaleads")) {
      return Promise.resolve(new Response(JSON.stringify([row]), { headers: { "content-range": "0-0/1" } }));
    }
    return Promise.resolve(new Response(JSON.stringify({ run: null })));
  });
  vi.stubGlobal("fetch", fetcher);

  render(<TestDashboard />);
  await showSavedLeads();
  await userEvent.click(screen.getByRole("button", { name: "CRM" }));
  expect(await screen.findByText("Farmácia Veloz")).toBeInTheDocument();

  // Dois cliques rápidos seguidos: Em contato -> Respondido -> Qualificado
  await userEvent.click(screen.getByRole("button", { name: /Avançar etapa/ }));
  await userEvent.click(screen.getByRole("button", { name: /Avançar etapa/ }));

  expect(within(screen.getByLabelText("Coluna Qualificado")).getByText("Farmácia Veloz")).toBeInTheDocument();
  expect(screen.getByText("100%")).toBeInTheDocument();
  expect(patchResolvers).toHaveLength(2);

  // Primeira requisição falha/chega atrasada -> NÃO deve sobrescrever ou reverter "Qualificado"
  patchResolvers[0](new Response(JSON.stringify({ message: "Erro antigo" }), { status: 500 }));
  await Promise.resolve();
  expect(within(screen.getByLabelText("Coluna Qualificado")).getByText("Farmácia Veloz")).toBeInTheDocument();
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();

  // Segunda requisição confirma "Qualificado"
  patchResolvers[1](new Response(JSON.stringify([{ ...row, crm_status: "Qualificado" }]), { status: 200 }));
  await waitFor(() => expect(within(screen.getByLabelText("Coluna Qualificado")).getByText("Farmácia Veloz")).toBeInTheDocument());
});
