import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { ProspectSearch } from "./ProspectSearch";

afterEach(() => vi.unstubAllGlobals());
test("pesquisa com filtros, muda de página e limpa a consulta sem mascarar contatos", async () => {
  const fetcher = vi.fn(async (input: string) => {
    const offset = new URL(input).searchParams.get("offset") || "0";
    return new Response(JSON.stringify([{ chave: "test", nome: "Registro de verificação", segmento: "manipulacao", local_busca: "São Paulo, SP", telefone: "+5511999991234", emails: "contato@exemplo.com.br", site: "", link: "", whatsapp_link: "", crm_status: "Qualificado" }]), { headers: { "content-range": `${offset}-${offset}/26` } });
  });
  vi.stubGlobal("fetch", fetcher);
  render(<ProspectSearch dataSourceMode="supabase" session={{ access_token: "test", refresh_token: "test", expires_at: Date.now() + 3600000 }} realLeads={[]} />);
  expect(await screen.findByText("contato@exemplo.com.br")).toBeInTheDocument();
  expect(screen.getByText("+5511999991234")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: /Tipo de estabelecimento/ }));
  await userEvent.click(screen.getByRole("checkbox", { name: "Farmácia de Manipulação" }));
  await userEvent.click(screen.getByRole("button", { name: /Tipo de estabelecimento/ }));
  await userEvent.click(screen.getByRole("button", { name: /Estado Todos/ }));
  await userEvent.type(screen.getByRole("searchbox", { name: "Buscar em Estado" }), "sao");
  await userEvent.click(screen.getByRole("checkbox", { name: "São Paulo (SP)" }));
  await userEvent.click(screen.getByRole("button", { name: /Estado São Paulo/ }));
  await userEvent.click(screen.getByRole("button", { name: "Pesquisar" }));
  await waitFor(() => expect(new URL(String(fetcher.mock.calls.at(-1)?.[0])).searchParams.get("segmento")).toBe("in.(manipulacao)"));
  expect(screen.getByRole("heading", { name: "Farmácia de Manipulação em São Paulo (SP)" })).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Próxima página da pesquisa" }));
  await waitFor(() => expect(new URL(String(fetcher.mock.calls.at(-1)?.[0])).searchParams.get("offset")).toBe("25"));
  await userEvent.click(screen.getByRole("button", { name: "Limpar filtros" }));
  await waitFor(() => expect(new URL(String(fetcher.mock.calls.at(-1)?.[0])).searchParams.has("segmento")).toBe(false));
});
