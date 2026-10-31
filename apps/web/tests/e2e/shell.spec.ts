import { expect, test } from "@playwright/test";

test("painel mostra estado vazio e é responsivo", async ({ page }) => {
  await page.route("**/api/config", route => route.fulfill({json:{segmentos:[{id:"varejo",descricao:"Farmácias e drogarias"}]}}));
  await page.route("**/api/status", route => route.fulfill({json:{total_leads:0,execucao:null,consulta_atual:null}}));
  await page.route("**/api/leads**", route => route.fulfill({json:{items:[],total:0,next_offset:null}}));
  await page.goto("/");
  await expect(page.getByRole("heading",{name:"Configurar busca"})).toBeVisible();
  await expect(page.getByText("Nenhum estabelecimento encontrado.")).toBeVisible();
  await expect(page.getByRole("button",{name:"Iniciar coleta"})).toBeDisabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
