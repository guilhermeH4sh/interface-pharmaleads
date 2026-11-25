import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import * as csv from "../../lib/csv";
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

  expect(screen.queryByRole("table")).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("combobox", { name: "Tipo de estabelecimento" }));
  await userEvent.click(screen.getByRole("option", { name: "Farmácia de Manipulação" }));
  await userEvent.keyboard("{Escape}");
  await userEvent.click(screen.getByRole("button", { name: "Aplicar filtros" }));

  const table = screen.getByRole("table");
  expect(within(table).getByText("Farmácia Manipulação")).toBeInTheDocument();
  expect(within(table).queryByText("Farmácia Varejo")).not.toBeInTheDocument();
  await waitFor(() => expect(new URLSearchParams(window.location.search).get("segmentos")).toBe("manipulacao"));

  await userEvent.click(screen.getByRole("combobox", { name: "Tipo de estabelecimento" }));
  await userEvent.click(screen.getByRole("option", { name: "Farmácia de Varejo / Drogaria" }));
  await userEvent.keyboard("{Escape}");
  await userEvent.click(screen.getByRole("button", { name: "Aplicar filtros" }));
  expect(within(table).getByText("Farmácia Varejo")).toBeInTheDocument();
  expect(within(table).getByText("Farmácia Manipulação")).toBeInTheDocument();

  await userEvent.click(screen.getByRole("button", { name: "Limpar filtros" }));
  expect(screen.queryByRole("table")).not.toBeInTheDocument();
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
    const panel = listbox.parentElement as HTMLElement;
    expect(panel.style.width).toBe("176px");
    expect(panel.style.right).toBe("309px");
    expect(panel.style.top).toBe("134px");
  } finally {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: originalInnerWidth });
    if (originalClientWidth) Object.defineProperty(document.documentElement, "clientWidth", originalClientWidth);
  }
});

test("select múltiplo exibe resumo no gatilho, Limpar seleção e abre para baixo quando há >= 200 px abaixo", async () => {
  const originalClientHeight = Object.getOwnPropertyDescriptor(document.documentElement, "clientHeight");
  Object.defineProperty(document.documentElement, "clientHeight", { configurable: true, value: 700 });

  try {
    render(<LeadsView searchQuery="" dataSourceMode="supabase" realLeads={leads}
      isSupabaseAuthenticated onBatchAddToCrm={async () => []} />);
    const trigger = screen.getByRole("combobox", { name: "Tipo de estabelecimento" });
    vi.spyOn(trigger, "getBoundingClientRect").mockReturnValue({
      x: 40, y: 400, left: 40, right: 260, top: 400, bottom: 440, width: 220, height: 40,
      toJSON: () => ({}),
    } as DOMRect);

    expect(trigger).toHaveTextContent("Todos");
    await userEvent.click(trigger);

    const listbox = screen.getByRole("listbox", { name: "Tipo de estabelecimento" });
    const panel = listbox.parentElement as HTMLElement;
    expect(listbox).toHaveAttribute("aria-multiselectable", "true");
    // 700 - 440 - 6 - 16 = 238 px >= 200 px -> abre para baixo com maxHeight 238 px
    expect(panel.style.top).toBe("446px");
    expect(panel.style.maxHeight).toBe("238px");

    await userEvent.click(within(listbox).getByRole("option", { name: "Farmácia de Manipulação" }));
    expect(trigger).toHaveTextContent("Farmácia de Manipulação");
    await userEvent.click(within(listbox).getByRole("option", { name: "Farmácia Veterinária" }));
    expect(trigger).toHaveTextContent("2 selecionados");

    await userEvent.click(within(panel).getByRole("button", { name: "Limpar seleção" }));
    expect(trigger).toHaveTextContent("Todos");
  } finally {
    if (originalClientHeight) Object.defineProperty(document.documentElement, "clientHeight", originalClientHeight);
  }
});

test("ignora filtros geográficos antigos e exporta todas as páginas da UF aplicada", async () => {
  window.history.replaceState({}, "", "/?uf=PR&municipio=Inexistente&bairro=Inexistente");
  const exportCsv = vi.spyOn(csv, "downloadLeadsCsv").mockImplementation(() => {});
  const prLeads = Array.from({ length: 24 }, (_, index) => ({
    ...base, id: String(index), nome: `Farmácia PR ${index}`, ultimaColeta: new Date().toISOString(),
  }));
  const spLead = { ...base, id: "sp", nome: "Farmácia SP", cidade: "Santos", uf: "SP", ultimaColeta: new Date().toISOString() };
  try {
    render(<LeadsView searchQuery="" dataSourceMode="supabase" realLeads={[...prLeads, spLead]}
      isSupabaseAuthenticated onBatchAddToCrm={async () => []} />);
    const filters = screen.getByRole("region", { name: "Filtros dos leads" });
    await userEvent.click(within(filters).getByRole("button", { name: "Aplicar filtros" }));
    expect(within(filters).getAllByRole("combobox")).toHaveLength(4);
    expect(within(filters).getByRole("combobox", { name: "UF" })).toHaveTextContent("PR");
    expect(screen.queryByText("Farmácia SP")).not.toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "Resumo dos leads" })).getByText("24")).toBeInTheDocument();
    expect(within(screen.getByRole("table")).getAllByRole("row").length).toBeLessThan(25);
    await waitFor(() => expect(window.location.search).not.toMatch(/municipio|bairro/));
    await userEvent.click(screen.getByRole("button", { name: /^Exportar$/ }));
    expect(exportCsv).toHaveBeenCalledWith(prLeads, "pharmaleads_ultimos_7_dias");
    await userEvent.click(within(filters).getByRole("combobox", { name: "UF" }));
    await userEvent.click(screen.getByRole("option", { name: "SP" }));
    await userEvent.click(within(filters).getByRole("button", { name: "Aplicar filtros" }));
    expect(within(screen.getByRole("table")).getByText("Farmácia SP")).toBeInTheDocument();
  } finally {
    exportCsv.mockRestore();
  }
});
