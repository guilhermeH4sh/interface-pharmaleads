import { expect, test } from "@playwright/test";

test("barra de coleta central, sem tabela, funciona nos dois temas e no mobile", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => { if (["error", "warning"].includes(message.type())) errors.push(message.text()); });
  await page.route("**/api/status", route => route.fulfill({ json: { total_leads: 0, execucao: null, consulta_atual: null } }));
  await page.route("**/api/leads**", route => route.fulfill({ json: { items: [], total: 0, next_offset: null } }));
  await page.route("**/api/coletas", route => route.fulfill({ json: { id: 1 }, status: 202 }));
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Encontre novas farmácias" })).toBeVisible();
  await expect(page.getByRole("table")).toHaveCount(0);
  await expect(page.getByRole("searchbox", { name: "Cidade ou bairro" })).toHaveCount(1);
  await expect(page.getByRole("combobox", { name: "UF", exact: true }).locator("option")).toHaveCount(28);
  for (const width of [360, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    for (const theme of ["light", "dark"]) {
      const toggle = page.getByRole("button", { name: theme === "dark" ? "Ativar tema escuro" : "Ativar tema claro" });
      if (await toggle.count()) await toggle.click();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await expect(page.getByRole("button", { name: "Pesquisar", exact: true })).toBeVisible();
    }
  }
  await page.screenshot({ path: test.info().outputPath("prospeccao-central.png"), fullPage: true });
  await page.getByRole("searchbox", { name: "Cidade ou bairro" }).fill("Curitiba");
  await page.getByRole("combobox", { name: "UF", exact: true }).selectOption("PR");
  await expect(page.getByRole("button", { name: "Pesquisar", exact: true })).toBeEnabled();
  const request = page.waitForRequest(req => req.url().endsWith("/api/coletas") && req.method() === "POST");
  await page.getByRole("button", { name: "Pesquisar", exact: true }).click();
  expect((await request).postDataJSON()).toMatchObject({ locais: ["Curitiba, PR"], segmentos: ["varejo"] });
  await page.getByRole("button", { name: "Ver leads", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Leads – Farmácias" })).toBeVisible();
  expect(errors).toEqual([]);
});
