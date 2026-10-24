import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { expect, test } from "vitest";
import { App } from "./App";

test("navegação do shell é acessível e não apresenta operação comercial", async () => {
  const user = userEvent.setup();
  render(<MemoryRouter><App /></MemoryRouter>);
  expect(screen.getByRole("heading", { name: "Ambiente em construção" })).toBeVisible();
  expect(screen.queryByRole("button", { name: /coletar|exportar|entrar/i })).not.toBeInTheDocument();
  await user.click(screen.getByRole("link", { name: /Conhecer as etapas/ }));
  expect(screen.getByRole("heading", { name: "Uma etapa de cada vez." })).toBeVisible();
  expect(screen.getByRole("main")).toHaveFocus();
  expect(screen.getByRole("link", { name: "Etapas do projeto" })).toHaveAttribute("aria-current", "page");
});

test("rota inexistente informa erro e oferece retorno", () => {
  render(<MemoryRouter initialEntries={["/inexistente"]}><App /></MemoryRouter>);
  expect(screen.getByRole("heading", { name: "Página não encontrada" })).toBeVisible();
  expect(screen.getByRole("link", { name: "Voltar ao início" })).toHaveAttribute("href", "/");
});
