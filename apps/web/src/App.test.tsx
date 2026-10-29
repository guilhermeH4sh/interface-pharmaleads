import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { App } from "./App";

afterEach(() => vi.unstubAllGlobals());
test("sem login não consulta serviços nem apresenta leads fictícios", () => {
  const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
  render(<App />);
  expect(screen.getByLabelText("E-mail")).toBeVisible();
  expect(screen.getByLabelText("Senha")).toHaveAttribute("type", "password");
  expect(fetcher).not.toHaveBeenCalled();
  expect(screen.queryByText("Pipeline de leads")).not.toBeInTheDocument();
});

test("erro de autenticação não inventa sessão ou dados", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 400 }));
  const user = userEvent.setup(); render(<App />);
  await user.type(screen.getByLabelText("E-mail"), "fixture@example.test");
  await user.type(screen.getByLabelText("Senha"), "fixture-password");
  await user.type(screen.getByLabelText(/Chave publicável/), "sb_publishable_fixture");
  await user.click(screen.getByRole("button", { name: /Acessar plataforma/ }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Confira seu e-mail e senha");
  expect(screen.queryByText("Pipeline de leads")).not.toBeInTheDocument();
});
