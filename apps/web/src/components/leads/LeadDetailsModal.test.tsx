import { render, screen, within } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { LeadDetailsModal } from "./LeadDetailsModal";
import { mapRawLeadsToItems } from "../../lib/backend";
import type { Lead } from "../../lib/crm";

function leadWithEmails(emails: string) {
  const row: Lead = {
    chave: "email-test", nome: "Farmácia real", segmento: "varejo", categoria: "Farmácia",
    endereco: "Curitiba, PR", local_busca: "Curitiba, PR", telefone: "", telefone_normalizado: "",
    celular: 0, whatsapp_link: "", site: "", emails, situacao: "ativa_ou_desconhecida",
    avaliacao: "", qtd_avaliacoes: "", latitude: "", longitude: "", link: "",
  };
  return mapRawLeadsToItems([row])[0];
}

test("mantém o campo E-mail visível quando não há endereço coletado", () => {
  render(<LeadDetailsModal lead={leadWithEmails("")} onClose={vi.fn()} onChangeStatus={vi.fn()} />);
  expect(screen.getByText("E-mail")).toBeInTheDocument();
  expect(within(screen.getByText("E-mail").parentElement!).getByText("Não informado")).toBeInTheDocument();
  expect(screen.queryByRole("link", { name: /@/ })).not.toBeInTheDocument();
});

test("exibe e-mails do Supabase em links individuais, sem duplicatas", () => {
  render(<LeadDetailsModal lead={leadWithEmails("contato@farmacia.com.br, vendas@farmacia.com.br; contato@farmacia.com.br")} onClose={vi.fn()} onChangeStatus={vi.fn()} />);
  expect(screen.getAllByRole("link", { name: "contato@farmacia.com.br" })).toHaveLength(1);
  expect(screen.getByRole("link", { name: "contato@farmacia.com.br" })).toHaveAttribute("href", "mailto:contato@farmacia.com.br");
  expect(screen.getByRole("link", { name: "vendas@farmacia.com.br" })).toHaveAttribute("href", "mailto:vendas@farmacia.com.br");
  expect(within(screen.getByText("E-mail").parentElement!).queryByText("Não informado")).not.toBeInTheDocument();
});
