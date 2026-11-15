import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { LeadsView } from "./LeadsView";
import type { LeadItem } from "../../lib/mock-leads";

const base: LeadItem = {
  id: "1", nome: "Farmácia Varejo", cnpj: "", cidade: "Curitiba", uf: "PR", bairro: "Centro",
  telefone: "", status: "Não contatado", origem: "Google Maps", segmento: "varejo", email: "contato@exemplo.com.br",
};
const leads: LeadItem[] = [
  base,
  { ...base, id: "2", nome: "Farmácia Manipulação", segmento: "manipulacao" },
  { ...base, id: "3", nome: "Farmácia Veterinária", segmento: "veterinaria", email: "" },
];

afterEach(() => window.history.replaceState({}, "", "/"));

test("filtra tipos de leads em conjunto com e-mail e guarda a seleção na URL", async () => {
  render(<LeadsView searchQuery="" dataSourceMode="supabase" realLeads={leads}
    isSupabaseAuthenticated onBatchAddToCrm={async () => []} />);

  const table = screen.getByRole("table");
  expect(within(table).getByText("Farmácia Varejo")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: /Tipo de estabelecimento/ }));
  await userEvent.click(screen.getByRole("checkbox", { name: "Farmácia de Manipulação" }));
  await userEvent.click(screen.getByRole("button", { name: "Aplicar filtros" }));

  expect(within(table).getByText("Farmácia Manipulação")).toBeInTheDocument();
  expect(within(table).queryByText("Farmácia Varejo")).not.toBeInTheDocument();
  await waitFor(() => expect(new URLSearchParams(window.location.search).get("segmentos")).toBe("manipulacao"));

  await userEvent.click(screen.getByRole("button", { name: /Tipo de estabelecimento/ }));
  await userEvent.click(screen.getByRole("checkbox", { name: "Farmácia de Varejo / Drogaria" }));
  await userEvent.click(screen.getByRole("button", { name: "Aplicar filtros" }));
  expect(within(table).getByText("Farmácia Varejo")).toBeInTheDocument();
  expect(within(table).getByText("Farmácia Manipulação")).toBeInTheDocument();

  await userEvent.click(screen.getByRole("button", { name: "Limpar filtros" }));
  expect(within(table).getByText("Farmácia Veterinária")).toBeInTheDocument();
  await waitFor(() => expect(new URLSearchParams(window.location.search).has("segmentos")).toBe(false));
});

test("seletor de período customizado abre listbox acessível, navega por teclado e fecha ao clicar fora ou Esc", async () => {
  render(<LeadsView searchQuery="" dataSourceMode="supabase" realLeads={leads}
    isSupabaseAuthenticated onBatchAddToCrm={async () => []} />);

  const trigger = screen.getByRole("combobox", { name: "Período para exportação" });
  expect(trigger).toHaveTextContent("Últimos 7 dias");
  expect(trigger).toHaveAttribute("aria-expanded", "false");

  // Abre pelo clique e verifica opções no portal
  await userEvent.click(trigger);
  expect(trigger).toHaveAttribute("aria-expanded", "true");
  const listbox = screen.getByRole("listbox", { name: "Período para exportação" });
  expect(within(listbox).getByRole("option", { name: "Últimos 7 dias" })).toHaveAttribute("aria-selected", "true");

  // Seleciona "Últimos 30 dias"
  await userEvent.click(within(listbox).getByRole("option", { name: "Últimos 30 dias" }));
  expect(trigger).toHaveTextContent("Últimos 30 dias");
  await waitFor(() => expect(screen.queryByRole("listbox")).not.toBeInTheDocument());

  // Navegação por teclado: ArrowDown -> End -> Enter seleciona "Todo o período" e retorna foco
  trigger.focus();
  await userEvent.keyboard("{ArrowDown}{End}{Enter}");
  expect(trigger).toHaveTextContent("Todo o período");
  await waitFor(() => expect(trigger).toHaveFocus());

  // Abre novamente e fecha com Esc
  await userEvent.keyboard(" ");
  expect(screen.getByRole("listbox")).toBeInTheDocument();
  await userEvent.keyboard("{Escape}");
  await waitFor(() => expect(screen.queryByRole("listbox")).not.toBeInTheDocument());
  await waitFor(() => expect(trigger).toHaveFocus());

  // Abre e fecha ao clicar fora
  await userEvent.click(trigger);
  expect(screen.getByRole("listbox")).toBeInTheDocument();
  await userEvent.click(document.body);
  await waitFor(() => expect(screen.queryByRole("listbox")).not.toBeInTheDocument());
});

test("alinha o painel do seletor à largura e borda direita do gatilho ignorando a barra de rolagem", async () => {
  const originalInnerWidth = window.innerWidth;
  const originalClientWidth = Object.getOwnPropertyDescriptor(document.documentElement, "clientWidth");
  Object.defineProperty(window, "innerWidth", { configurable: true, value: 1280 });
  Object.defineProperty(document.documentElement, "clientWidth", { configurable: true, value: 1265 });

  try {
    render(<LeadsView searchQuery="" dataSourceMode="supabase" realLeads={leads}
      isSupabaseAuthenticated onBatchAddToCrm={async () => []} />);
    const trigger = screen.getByRole("combobox", { name: "Período para exportação" });
    vi.spyOn(trigger, "getBoundingClientRect").mockReturnValue({
      x: 780, y: 80, left: 780, right: 956, top: 80, bottom: 128, width: 176, height: 48,
      toJSON: () => ({}),
    } as DOMRect);

    await userEvent.click(trigger);
    const listbox = screen.getByRole("listbox", { name: "Período para exportação" });
    expect(listbox.style.minWidth).toBe("176px");
    expect(listbox.style.right).toBe("309px");
    expect(listbox.style.top).toBe("134px");
  } finally {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: originalInnerWidth });
    if (originalClientWidth) Object.defineProperty(document.documentElement, "clientWidth", originalClientWidth);
  }
});
