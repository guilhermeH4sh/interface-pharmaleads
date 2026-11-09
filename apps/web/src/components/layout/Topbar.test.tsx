import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { Topbar } from "./Topbar";

test("mantém a animação visível enquanto sincroniza os leads", async () => {
  let release: (() => void) | undefined;
  const onRefreshData = vi.fn(() => new Promise<void>((resolve) => { release = resolve; }));

  render(
    <Topbar
      onToggleMobileMenu={vi.fn()}
      theme="light"
      onToggleTheme={vi.fn()}
      dataSourceMode="supabase"
      isSupabaseAuthenticated
      onRefreshData={onRefreshData}
    />
  );

  await userEvent.click(screen.getByRole("button", { name: "Atualizar leads da base ativa" }));

  const refreshing = screen.getByRole("button", { name: "Sincronizando leads" });
  expect(refreshing).toBeDisabled();
  expect(refreshing).toHaveAttribute("aria-busy", "true");
  expect(refreshing.querySelector("svg")).toHaveClass("animate-spin");
  expect(onRefreshData).toHaveBeenCalledTimes(1);

  release?.();
  await waitFor(
    () => expect(screen.getByRole("button", { name: "Atualizar leads da base ativa" })).toBeEnabled(),
    { timeout: 1500 }
  );
});
