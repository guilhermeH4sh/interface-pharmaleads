import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { PlatformDashboard } from "./App";
import { ProspeccaoTab } from "./components/prospeccao/ProspeccaoTab";
import { AUTHORIZED_USER_ID, SESSION_KEY, savedSupabaseSession } from "./lib/backend";

function TestDashboard() {
  return <PlatformDashboard initialSession={savedSupabaseSession() || { access_token: "test", refresh_token: "test", expires_at: 4102444800000 }} onSignOut={vi.fn()} />;
}

beforeEach(() => { window.localStorage.clear(); window.sessionStorage.clear(); });
afterEach(() => vi.unstubAllGlobals());

test("Prospecção autenticada não consulta ou exibe dados de leads", async () => {
  window.sessionStorage.setItem(SESSION_KEY, JSON.stringify({ access_token: "test", refresh_token: "test", expires_at: Date.now() + 3600000 }));
  const fetcher = vi.fn(async () => new Response(JSON.stringify({ run: null })));
  vi.stubGlobal("fetch", fetcher);
  render(<TestDashboard />);
  expect(screen.getByRole("searchbox", { name: "Cidade ou bairro" })).toBeInTheDocument();
  expect(screen.queryByRole("table")).not.toBeInTheDocument();
  await waitFor(() => expect(fetcher).toHaveBeenCalled());
  expect(fetcher.mock.calls.flat().some(value => String(value).includes("/rest/v1/pharmaleads"))).toBe(false);
});

test("abre em Prospecção e mantém dados nas abas Leads e CRM", async () => {
  render(<TestDashboard />);
  expect(screen.getByRole("heading", { name: "Encontre novas farmácias" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Prospecção" })).toHaveAttribute("aria-current", "page");
  expect(screen.getAllByRole("searchbox")).toHaveLength(1);
  expect(screen.queryByRole("table")).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Ver leads" }));
  expect(screen.getByRole("heading", { name: "Leads – Farmácias" })).toBeInTheDocument();
  expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "CRM" }));
  expect(screen.getByText("Pipeline Comercial & Funil CRM")).toBeInTheDocument();
});

test("a barra envia a cidade corrigida e os filtros para o scraper local", async () => {
  const fetcher = vi.fn(async (input: string, init?: RequestInit) => {
    if (input === "/api/coletas") expect(JSON.parse(String(init?.body))).toMatchObject({ locais: ["São Paulo, SP"], segmentos: ["varejo"], profundidade: 1, emails: true });
    return new Response(JSON.stringify(input === "/api/coletas" ? { id: 1 } : { total_leads: 0, execucao: null, consulta_atual: null }));
  });
  vi.stubGlobal("fetch", fetcher);
  render(<ProspeccaoTab dataSourceMode="local" />);
  await userEvent.type(screen.getByRole("searchbox", { name: "Cidade ou bairro" }), "sao pauli");
  await userEvent.selectOptions(screen.getByRole("combobox", { name: "UF" }), "SP");
  await userEvent.click(screen.getByRole("button", { name: "Pesquisar" }));
  await waitFor(() => expect(fetcher.mock.calls.some(call => call[0] === "/api/coletas")).toBe(true));
  expect(screen.getByRole("button", { name: "Parar coleta" })).toBeInTheDocument();
});

test("a barra inicia o GitHub Actions e desabilita fontes não integradas", async () => {
  const fetcher = vi.fn(async (input: string, init?: RequestInit) => {
    if (input === "/api/collector" && init?.method === "POST") {
      expect(JSON.parse(String(init.body))).toMatchObject({ action: "start", locais: "Curitiba, PR", segmentos: ["varejo"], profundidade: 1, emails: true });
      return new Response(JSON.stringify({ run: { id: 0, status: "queued", url: "https://github.com/example/actions" } }));
    }
    return new Response(JSON.stringify({ run: null }));
  });
  vi.stubGlobal("fetch", fetcher);
  render(<ProspeccaoTab dataSourceMode="supabase" supabaseSession={{ access_token: "test", refresh_token: "test", expires_at: Date.now() + 3600000 }} />);
  expect(screen.getByRole("option", { name: "Receita Federal (em breve)" })).toBeDisabled();
  await userEvent.type(screen.getByRole("searchbox"), "Curitiba");
  await userEvent.selectOptions(screen.getByRole("combobox", { name: "UF" }), "PR");
  await userEvent.click(screen.getByRole("button", { name: "Pesquisar" }));
  await waitFor(() => expect(fetcher.mock.calls.some(call => call[1]?.method === "POST")).toBe(true));
  expect(screen.queryByRole("table")).not.toBeInTheDocument();
});


test("configurações mostram apenas Supabase e preservam a conexão existente", async () => {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({ access_token: "test", refresh_token: "test", expires_at: Date.now() + 3600000 }));
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ run: null }))));
  render(<TestDashboard />);
  await userEvent.click(screen.getByRole("button", { name: "Configurações" }));
  expect(screen.getByRole("status")).toHaveTextContent("Conectado");
  expect(screen.queryByRole("textbox", { name: /E-mail/ })).not.toBeInTheDocument();
  expect(screen.queryByText("SQLite Local + Gosom")).not.toBeInTheDocument();
  expect(screen.queryByText("Modo Demonstração (Mock)")).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Encerrar Sessão" })).not.toBeInTheDocument();
  expect(localStorage.getItem(SESSION_KEY)).toContain("refresh_token");
});


test("Nova Prospecção redireciona sem abrir modal nem iniciar coleta", async () => {
  const fetcher = vi.fn(async () => new Response(JSON.stringify({ run: null })));
  vi.stubGlobal("fetch", fetcher);
  render(<TestDashboard />);
  await userEvent.click(screen.getByRole("button", { name: "Leads" }));
  await userEvent.click(screen.getByRole("button", { name: "Nova Prospecção" }));
  expect(screen.getByRole("heading", { name: "Encontre novas farmácias" })).toBeInTheDocument();
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(fetcher.mock.calls.some(call => String(call).includes("POST"))).toBe(false);
});

test("adiciona lead real ao CRM e mantém o vínculo ao voltar à aba", async () => {
  localStorage.setItem(SESSION_KEY, JSON.stringify({ access_token: "test", refresh_token: "test", expires_at: Date.now() + 3600000 }));
  let included = false;
  const lead = () => ({ chave: "real-1", nome: "Farmácia da base", local_busca: "Curitiba, PR", segmento: "varejo", crm_included: included, crm_status: "Não contatado" });
  const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
    if (url.includes("/auth/v1/user")) return new Response(JSON.stringify({ id: AUTHORIZED_USER_ID }));
    if (url.includes("/rest/v1/pharmaleads")) {
      if (init?.method === "PATCH") {
        const patch = JSON.parse(String(init.body));
        expect(typeof patch.crm_included).toBe("boolean");
        included = patch.crm_included;
      }
      return new Response(JSON.stringify([lead()]), { headers: { "content-range": "0-0/1" } });
    }
    return new Response(JSON.stringify({ run: null }));
  });
  vi.stubGlobal("fetch", fetcher);
  render(<TestDashboard />);
  await userEvent.click(screen.getByRole("button", { name: "CRM" }));
  await userEvent.click(screen.getByRole("button", { name: "Adicionar leads" }));
  const add = await screen.findByRole("button", { name: "Adicionar Farmácia da base ao CRM" });
  await userEvent.click(add);
  await waitFor(() => expect(screen.queryByRole("button", { name: "Adicionar Farmácia da base ao CRM" })).not.toBeInTheDocument());
  expect(included).toBe(true);
  await userEvent.keyboard("{Escape}");
  expect(screen.getByText("Farmácia da base")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Leads" }));
  expect(screen.queryByText("Farmácia da base")).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "CRM" }));
  expect(await screen.findByText("Farmácia da base")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Remover Farmácia da base do CRM" }));
  await waitFor(() => expect(screen.queryByText("Farmácia da base")).not.toBeInTheDocument());
  expect(included).toBe(false);
  await userEvent.click(screen.getByRole("button", { name: "Leads" }));
  expect(await screen.findByRole("button", { name: "Farmácia da base" })).toBeInTheDocument();
});

test("mudar o status em Leads salva status e vínculo juntos e move o lead para o CRM", async () => {
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
  await userEvent.click(screen.getByRole("button", { name: "Leads" }));
  await userEvent.click(await screen.findByRole("button", { name: "Farmácia em negociação" }));
  await userEvent.click(screen.getByRole("button", { name: "Em contato" }));
  await waitFor(() => expect(screen.queryByRole("button", { name: "Farmácia em negociação" })).not.toBeInTheDocument());
  expect(included).toBe(true);
  await userEvent.click(screen.getByRole("button", { name: "CRM" }));
  expect(await screen.findByText("Farmácia em negociação")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Leads" }));
  expect(screen.queryByText("Farmácia em negociação")).not.toBeInTheDocument();
  await userEvent.selectOptions(screen.getByRole("combobox", { name: "Status" }), "Em contato");
  await userEvent.click(screen.getByRole("button", { name: "Aplicar filtros" }));
  expect(screen.getByText("Pipeline Comercial & Funil CRM")).toBeInTheDocument();
  expect(screen.getByText("Farmácia em negociação")).toBeInTheDocument();
  expect(screen.getByText("1 de 1 leads no CRM")).toBeInTheDocument();
});

test("filtros de CRM mostram apenas o contato persistido e navegação rápida reutiliza a leitura", async () => {
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
  await userEvent.click(screen.getByRole("button", { name: "CRM" }));
  expect(await screen.findByText("Farmácia Paraná")).toBeInTheDocument();
  const reads = fetcher.mock.calls.filter(call => String(call[0]).includes("/rest/v1/pharmaleads")).length;
  await userEvent.selectOptions(screen.getByRole("combobox", { name: "UF" }), "PR");
  await userEvent.selectOptions(screen.getByRole("combobox", { name: "E-mail" }), "com");
  await userEvent.click(screen.getByRole("button", { name: "Aplicar filtros" }));
  expect(screen.getByText("Farmácia Paraná")).toBeInTheDocument();
  expect(screen.queryByText("Farmácia Paulista")).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Leads" }));
  await userEvent.click(screen.getByRole("button", { name: "CRM" }));
  expect(screen.getByText("Farmácia Paulista")).toBeInTheDocument();
  expect(fetcher.mock.calls.filter(call => String(call[0]).includes("/rest/v1/pharmaleads"))).toHaveLength(reads);
});

test("falha ao salvar status mantém o lead em Leads", async () => {
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
  await userEvent.click(screen.getByRole("button", { name: "Leads" }));
  await userEvent.click(await screen.findByRole("button", { name: "Farmácia sem atualização" }));
  await userEvent.click(screen.getByRole("button", { name: "Em contato" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Sem permissão para atualizar");
  expect(screen.getByRole("button", { name: "Farmácia sem atualização" })).toBeInTheDocument();
});

test("Leads mostra o e-mail antes do responsável e filtra com ou sem endereço válido", async () => {
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
  await userEvent.click(screen.getByRole("button", { name: "Leads" }));
  expect(await within(screen.getByRole("table")).findByRole("link", { name: "contato@farmacia.com.br" })).toHaveAttribute("href", "mailto:contato@farmacia.com.br");
  const headers = screen.getAllByRole("columnheader").map((header) => header.textContent?.trim());
  expect(headers.indexOf("E-mail")).toBe(headers.indexOf("Responsável") - 1);

  await userEvent.selectOptions(screen.getByRole("combobox", { name: "E-mail" }), "com");
  await userEvent.click(screen.getByRole("button", { name: "Aplicar filtros" }));
  expect(screen.getByRole("button", { name: "Farmácia com e-mail" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Farmácia sem e-mail" })).not.toBeInTheDocument();

  await userEvent.selectOptions(screen.getByRole("combobox", { name: "E-mail" }), "sem");
  await userEvent.click(screen.getByRole("button", { name: "Aplicar filtros" }));
  expect(screen.getByRole("button", { name: "Farmácia sem e-mail" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Farmácia com e-mail" })).not.toBeInTheDocument();
});


test("Todas as UFs com pesquisa vazia despacha cobertura nacional ao clicar Pesquisar", async () => {
  const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
    if (url === "/api/collector" && init?.method === "POST") {
      expect(JSON.parse(String(init.body))).toMatchObject({ action: "start", cobertura: "nacional", segmentos: ["varejo"], profundidade: 1, emails: true });
      return new Response(JSON.stringify({ run: { id: 0, status: "queued", url: "https://example.test/actions" } }));
    }
    return new Response(JSON.stringify({ run: null }));
  });
  vi.stubGlobal("fetch", fetcher);
  render(<ProspeccaoTab dataSourceMode="supabase" supabaseSession={{ access_token: "test", refresh_token: "test", expires_at: Date.now() + 3600000 }} />);
  expect(screen.getByRole("combobox", { name: "UF" })).toHaveValue("");
  expect(screen.getByRole("option", { name: "Todas as UFs" })).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Pesquisar" }));
  await waitFor(() => expect(fetcher.mock.calls.some(call => call[1]?.method === "POST")).toBe(true));
  expect(screen.getByRole("status")).toHaveTextContent("Busca nacional solicitada");
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});
