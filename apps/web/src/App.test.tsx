import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { App } from "./App";
import { ProspeccaoTab } from "./components/prospeccao/ProspeccaoTab";
import { SESSION_KEY } from "./lib/backend";

beforeEach(() => { window.localStorage.clear(); window.sessionStorage.clear(); });
afterEach(() => vi.unstubAllGlobals());

test("entrada autenticada consulta uma página sem carregar a base inteira", async () => {
  window.sessionStorage.setItem(SESSION_KEY, JSON.stringify({ access_token: "test", refresh_token: "test", expires_at: Date.now() + 3600000 }));
  const fetcher = vi.fn(async (input: string) => input.includes("/rest/v1/pharmaleads")
    ? new Response("[]", { headers: { "content-range": "*/0" } })
    : new Response(JSON.stringify({ run: null })));
  vi.stubGlobal("fetch", fetcher);
  render(<App />);
  await screen.findByText("0 estabelecimentos encontrados");
  const calls = fetcher.mock.calls.filter(call => call[0].includes("/rest/v1/pharmaleads"));
  expect(calls).toHaveLength(1);
  expect(new URL(calls[0][0]).searchParams.get("limit")).toBe("25");
  expect(fetcher.mock.calls.some(call => call[0].includes("/auth/v1/user"))).toBe(false);
});

test("abre em Prospecção, ordena o menu e mantém o cabeçalho sem pesquisa global", async () => {
  render(<App />);
  expect(screen.getByRole("heading", { name: "Pesquisar estabelecimentos" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Prospecção" })).toHaveAttribute("aria-current", "page");
  const navigation = screen.getByRole("navigation", { name: "Navegação principal" });
  expect([...navigation.querySelectorAll("button")].map(button => button.textContent)).toEqual(["Prospecção", "Leads", "CRM", "Configurações", "Relatórios"]);
  expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Leads" }));
  expect(screen.getByRole("heading", { name: "Leads – Farmácias" })).toBeInTheDocument();
  expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "CRM" }));
  expect(screen.getByText("Pipeline Comercial & Funil CRM")).toBeInTheDocument();
  expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
});

test("coleta recolhível continua enviando a solicitação para a API local", async () => {
  const fetcher = vi.fn(async (input: string) => new Response(JSON.stringify(input === "/api/coletas" ? { id: 1 } : { total_leads: 0, execucao: null, consulta_atual: null })));
  vi.stubGlobal("fetch", fetcher);
  render(<ProspeccaoTab dataSourceMode="local" realLeads={[]} />);
  await userEvent.click(screen.getByText(/Coleta no Google Maps · configurar e acompanhar/));
  await userEvent.click(screen.getByRole("button", { name: "Iniciar Coleta" }));
  await waitFor(() => expect(fetcher.mock.calls.some(call => call[0] === "/api/coletas")).toBe(true));
});
