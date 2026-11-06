import { expect, test } from "@playwright/test";

test("pesquisa inicial funciona sem overflow e sem erros nos dois temas", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => { if (["error", "warning"].includes(message.type())) errors.push(message.text()); });
  await page.route("**/api/status", route => route.fulfill({ json: { total_leads: 0, execucao: null, consulta_atual: null } }));
  await page.route("**/api/leads**", route => route.fulfill({ json: { items: [], total: 0, next_offset: null } }));
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Pesquisar estabelecimentos" })).toBeVisible();
  await expect(page.getByText("Nenhum lead encontrado com esses filtros")).toBeVisible();
  await expect(page.getByRole("searchbox")).toHaveCount(0);
  for (const width of [360, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    for (const theme of ["light", "dark"]) {
      const toggle = page.getByRole("button", { name: theme === "dark" ? "Ativar tema escuro" : "Ativar tema claro" });
      if (await toggle.count()) await toggle.click();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await page.getByRole("button", { name: /Estado Todos/ }).click();
      await page.getByRole("searchbox", { name: "Buscar em Estado" }).fill("sao");
      await expect(page.getByRole("checkbox", { name: "São Paulo (SP)" })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await page.getByRole("button", { name: /Estado Todos/ }).click();
    }
  }
  await page.screenshot({ path: test.info().outputPath("prospeccao-desktop.png"), fullPage: true });
  expect(errors).toEqual([]);
});
