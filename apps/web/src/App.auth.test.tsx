import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, afterEach, expect, test, vi } from "vitest";
import { App } from "./App";
import { AUTHORIZED_USER_ID, SESSION_KEY } from "./lib/backend";

beforeEach(() => { localStorage.clear(); sessionStorage.clear(); });
afterEach(() => vi.unstubAllGlobals());
const stored = () => localStorage.setItem(SESSION_KEY, JSON.stringify({ access_token: "test", refresh_token: "test", expires_at: Date.now() + 3600000 }));

test("bloqueia a plataforma e não consulta leads ou coletor antes de entrar", () => {
  const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
  render(<App />);
  expect(screen.getByRole("heading", { name: "Acesse sua plataforma" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Leads" })).not.toBeInTheDocument();
  expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
  expect(fetcher).not.toHaveBeenCalled();
});

test("login libera a plataforma e sair encerra apenas o acesso do usuário", async () => {
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    if (url.includes("/auth/v1/token")) return new Response(JSON.stringify({ access_token: "test", refresh_token: "test", expires_in: 3600, user: { id: AUTHORIZED_USER_ID, email: "cliente@example.com" } }));
    if (url.includes("/auth/v1/user")) return new Response(JSON.stringify({ id: AUTHORIZED_USER_ID }));
    return new Response(JSON.stringify({ run: null }));
  }));
  render(<App />);
  await userEvent.type(screen.getByLabelText("E-mail"), "cliente@example.com");
  await userEvent.type(screen.getByLabelText("Senha"), "senha-de-teste");
  await userEvent.click(screen.getByRole("button", { name: "Entrar" }));
  expect(await screen.findByRole("heading", { name: "Encontre novas farmácias" })).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Configurações" }));
  expect(screen.getByRole("status")).toHaveTextContent("Supabase conectado");
  expect(screen.queryByLabelText("Senha")).not.toBeInTheDocument();
  expect(screen.queryByLabelText("E-mail")).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /Desconectar/ })).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Menu do usuário" }));
  await userEvent.click(screen.getByRole("menuitem", { name: "Sair da plataforma" }));
  expect(screen.getByRole("heading", { name: "Acesse sua plataforma" })).toBeInTheDocument();
  expect(localStorage.getItem(SESSION_KEY)).toBeNull();
});

test("restaura sessão válida sem pedir login novamente", async () => {
  stored();
  vi.stubGlobal("fetch", vi.fn(async (url: string) => new Response(JSON.stringify(url.includes("/auth/v1/user") ? { id: AUTHORIZED_USER_ID } : { run: null }))));
  render(<App />);
  expect(await screen.findByRole("heading", { name: "Encontre novas farmácias" })).toBeInTheDocument();
  expect(screen.queryByLabelText("Senha")).not.toBeInTheDocument();
});

test("recusa sessão inválida antes de carregar o coletor e os leads", async () => {
  stored();
  const fetcher = vi.fn(async () => new Response(JSON.stringify({}), { status: 401 }));
  vi.stubGlobal("fetch", fetcher);
  render(<App />);
  expect(await screen.findByRole("heading", { name: "Acesse sua plataforma" })).toBeInTheDocument();
  expect(fetcher.mock.calls).toHaveLength(1);
  expect(localStorage.getItem(SESSION_KEY)).toBeNull();
});

test("credenciais incorretas não liberam o painel", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: "invalid" }), { status: 400 })));
  render(<App />);
  await userEvent.type(screen.getByLabelText("E-mail"), "cliente@example.com");
  await userEvent.type(screen.getByLabelText("Senha"), "senha-errada");
  await userEvent.click(screen.getByRole("button", { name: "Entrar" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("E-mail ou senha inválidos");
  expect(screen.queryByRole("button", { name: "Leads" })).not.toBeInTheDocument();
  expect(screen.getByLabelText("Senha")).toHaveValue("");
});

test("falha temporária preserva a sessão e permite tentar novamente", async () => {
  stored(); let fail = true;
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    if (url.includes("/auth/v1/user")) return new Response(JSON.stringify({ id: AUTHORIZED_USER_ID }), { status: fail ? 503 : 200 });
    return new Response(JSON.stringify({ run: null }));
  }));
  render(<App />);
  const retry = await screen.findByRole("button", { name: "Tentar novamente" });
  expect(localStorage.getItem(SESSION_KEY)).not.toBeNull();
  expect(screen.queryByRole("button", { name: "Leads" })).not.toBeInTheDocument();
  fail = false;
  await userEvent.click(retry);
  await waitFor(() => expect(screen.getByRole("heading", { name: "Encontre novas farmácias" })).toBeInTheDocument());
});
