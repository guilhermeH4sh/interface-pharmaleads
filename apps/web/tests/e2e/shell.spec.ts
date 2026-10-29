import { expect, test } from "@playwright/test";

test("acesso real inicia sem dados, é responsivo e não consulta antes do login", async ({ page }) => {
  const external: string[] = [];
  page.on("request", request => { if (!request.url().startsWith("http://127.0.0.1:5173")) external.push(request.url()); });
  await page.goto("/");
  await expect(page.getByLabel("E-mail")).toBeVisible();
  await expect(page.getByRole("button", { name: "Acessar plataforma" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(external).toEqual([]);
  await page.screenshot({ path: `test-results/centrus-${test.info().project.name}.png`, fullPage: true });
});
