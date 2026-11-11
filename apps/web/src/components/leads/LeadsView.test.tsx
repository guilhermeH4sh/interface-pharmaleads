import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test } from "vitest";
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
