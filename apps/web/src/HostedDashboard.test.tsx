import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { HostedDashboard } from "./HostedDashboard";

afterEach(() => { vi.unstubAllGlobals(); sessionStorage.clear(); });

test("autentica a conta existente e lê os leads protegidos do Supabase", async () => {
  const fetcher = vi.fn(async (url: string, options?: RequestInit) => {
    if (url.includes("/auth/v1/token")) return {
      ok: true,
      json: async () => ({ access_token: "jwt-de-teste", refresh_token: "refresh-de-teste", expires_in: 3600, user: { id: "677ed1e4-3e73-4f2c-951f-e77386f305da" } }),
    };
    if (url.includes("/auth/v1/user")) return {
      ok: true,
      json: async () => ({ id: "677ed1e4-3e73-4f2c-951f-e77386f305da" }),
    };
    if (url.includes("/rest/v1/pharmaleads")) return {
      ok: true,
      status: 200,
      headers: { get: () => "0-0/1" },
      json: async () => [{ chave: "abc", nome: "Farmácia real", categoria: "Farmácia", local_busca: "Curitiba, PR", segmento: "varejo", telefone: "(41) 3333-4444", situacao: "ativa_ou_desconhecida", endereco: "Curitiba - PR", site: "", emails: "", link: "", whatsapp_link: "", ultima_coleta: "2026-11-02T15:00:00.000Z" }],
    };
    if (url === "/api/collector") {
      if (options?.method === "POST") {
        const payload = JSON.parse(String(options.body)) as { action?: string };
        return {
          ok: true,
          status: 202,
          json: async () => payload.action === "stop"
            ? { cancelling: true, run: { id: 1, status: "in_progress", conclusion: null, url: "https://example.test/1", created_at: "2026-11-02T12:00:00Z", title: "Atual" } }
            : { queued: true, run: { id: 0, status: "queued", conclusion: null, url: "https://example.test/actions", created_at: "2026-11-02T12:00:00Z", title: "Na fila" } },
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ run: { id: 99, status: "completed", conclusion: "success", url: "https://example.test/99", created_at: "2026-01-01T00:00:00Z", title: "Anterior" } }),
      };
    }
    throw new Error(`Rota inesperada: ${url} ${options?.method}`);
  });
  vi.stubGlobal("fetch", fetcher);
  render(<HostedDashboard />);
  expect(screen.queryByText("Farmácia real")).not.toBeInTheDocument();
  await userEvent.type(screen.getByLabelText("E-mail"), "teste@example.com");
  await userEvent.type(screen.getByLabelText("Senha"), "senha-de-teste");
  await userEvent.click(screen.getByRole("button", { name: "Entrar" }));
  expect(await screen.findByText("Farmácia real")).toBeVisible();
  expect(screen.getByRole("region", { name: "Cobertura por UF" })).toBeVisible();
  expect(screen.getByText("1 lead")).toBeVisible();
  expect(screen.getAllByText("0 leads")).toHaveLength(26);
  expect(fetcher.mock.calls.some(call => call[0].includes("/rest/v1/pharmaleads") && (call[1]?.headers as Record<string, string>).Authorization === "Bearer jwt-de-teste")).toBe(true);
  await userEvent.type(screen.getByLabelText("Cidades ou regiões"), "Curitiba, PR");
  expect(screen.getByRole("button", { name: "Parar coleta" })).toBeDisabled();
  await userEvent.click(screen.getByRole("button", { name: "Iniciar coleta" }));
  expect(fetcher.mock.calls.some(call => call[0] === "/api/collector" && call[1]?.method === "POST")).toBe(true);
  expect(screen.getByRole("button", { name: "Parar coleta" })).toBeEnabled();
  await userEvent.click(screen.getByRole("button", { name: "Parar coleta" }));
  expect(fetcher.mock.calls.some(call => call[0] === "/api/collector" && String(call[1]?.body).includes('"stop"'))).toBe(true);
  await userEvent.click(screen.getByRole("button", { name: "Iniciar cobertura nacional" }));
  const cobertura = fetcher.mock.calls.find(call => call[0] === "/api/collector" && String(call[1]?.body).includes("nacional"));
  expect(JSON.parse(String(cobertura?.[1]?.body))).toMatchObject({ action: "start", cobertura: "nacional", rodada: 1, emails: false, enriquecerSites: false });
  await userEvent.click(screen.getByRole("button", { name: "Sair" }));
  expect(screen.queryByText("Farmácia real")).not.toBeInTheDocument();
});

test("não mostra base vazia quando o login pertence a outro usuário", async () => {
  const fetcher = vi.fn(async () => ({
    ok: true,
    json: async () => ({ access_token: "outro-jwt", refresh_token: "outro-refresh", expires_in: 3600, user: { id: "outro-uid" } }),
  }));
  vi.stubGlobal("fetch", fetcher);
  render(<HostedDashboard />);
  await userEvent.type(screen.getByLabelText("E-mail"), "outro@example.com");
  await userEvent.type(screen.getByLabelText("Senha"), "senha-de-teste");
  await userEvent.click(screen.getByRole("button", { name: "Entrar" }));
  expect(await screen.findByText(/não é o usuário autorizado/)).toBeVisible();
  expect(sessionStorage.getItem("pharmaleads-supabase-session")).toBeNull();
  expect(fetcher).toHaveBeenCalledTimes(1);
});
