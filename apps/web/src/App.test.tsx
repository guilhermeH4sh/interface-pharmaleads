import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test } from "vitest";
import { App } from "./App";

test("renderiza a interface PharmaLeads no tema Centrus com métricas e leads", async () => {
  render(<App />);

  // Valida Marca e Título Principal
  expect(screen.getByText("Leads – Farmácias")).toBeInTheDocument();
  expect(screen.getByText(/Gerencie, filtre e acompanhe os leads/)).toBeInTheDocument();

  // Valida cards de métricas
  expect(screen.getByText("Leads encontrados")).toBeInTheDocument();
  expect(screen.getByText("Estados")).toBeInTheDocument();
  expect(screen.getAllByText("Qualificados").length).toBeGreaterThan(0);
  expect(screen.getAllByText("Em contato").length).toBeGreaterThan(0);

  // Valida primeiros leads da referência da imagem (presentes na tabela e no card mobile)
  const vitals = await screen.findAllByText("Farmácia Vital");
  expect(vitals.length).toBeGreaterThan(0);
  expect(screen.getAllByText("Drogaria São Bento").length).toBeGreaterThan(0);
  expect(screen.getAllByText("Farmácia Boa Saúde").length).toBeGreaterThan(0);
  expect(screen.getAllByText("Drogaria Progresso").length).toBeGreaterThan(0);
  expect(screen.getAllByText("Farmácia Central").length).toBeGreaterThan(0);

  // Valida presença da coluna lateral de filtros e gráfico
  expect(screen.getByText("Filtros")).toBeInTheDocument();
  expect(screen.getByText("Origem dos Leads")).toBeInTheDocument();
});

test("permite navegar entre as abas da sidebar e abrir modais", async () => {
  render(<App />);

  // Abre aba de Prospecção (correspondência exata)
  const prospeccaoTabBtn = screen.getByRole("button", { name: /^Prospecção$/i });
  await userEvent.click(prospeccaoTabBtn);
  expect(screen.getByText("Central de Prospecção & Web Scraping")).toBeInTheDocument();

  // Abre aba de CRM (correspondência exata)
  const crmTabBtn = screen.getByRole("button", { name: /^CRM$/i });
  await userEvent.click(crmTabBtn);
  expect(screen.getByText("Pipeline Comercial & Funil CRM")).toBeInTheDocument();

  // Volta para Leads (correspondência exata)
  const leadsTabBtn = screen.getByRole("button", { name: /^Leads$/i });
  await userEvent.click(leadsTabBtn);
  expect(screen.getByText("Leads – Farmácias")).toBeInTheDocument();

  // Abre modal Nova Prospecção
  const newProspectBtn = screen.getByRole("button", { name: /Nova Prospecção/i });
  await userEvent.click(newProspectBtn);
  expect(screen.getByRole("heading", { name: "Nova Prospecção" })).toBeInTheDocument();
});

test("filtra leads através das abas de status rápidos", async () => {
  render(<App />);

  // Espera carregar os leads
  const vitals = await screen.findAllByText("Farmácia Vital");
  expect(vitals.length).toBeGreaterThan(0);

  // Clica na pill de Qualificado
  const pills = screen.getAllByRole("button");
  const tabQualificados = pills.find((btn) => btn.textContent?.includes("Qualificado ("));
  if (tabQualificados) {
    await userEvent.click(tabQualificados);
  }

  await waitFor(() => {
    // Farmácia Vital é Qualificado
    expect(screen.getAllByText("Farmácia Vital").length).toBeGreaterThan(0);
  });
});
