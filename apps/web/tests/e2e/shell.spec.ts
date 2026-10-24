import { expect, test } from "@playwright/test";

test("shell navega, recarrega e cabe na tela sem acesso a serviços externos", async ({ page }) => {
  const external: string[] = [];
  page.on("request", (request) => {
    if (!request.url().startsWith("http://127.0.0.1:5173")) external.push(request.url());
  });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Ambiente em construção" })).toBeVisible();
  await page.screenshot({ path: `test-results/foundation-${test.info().project.name}.png`, fullPage: true });
  const stagesLink = page.getByRole("link", { name: /Conhecer as etapas/ });
  await stagesLink.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/etapas$/);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Uma etapa de cada vez." })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(external).toEqual([]);
  await page.screenshot({ path: `test-results/shell-${test.info().project.name}.png`, fullPage: true });
});
