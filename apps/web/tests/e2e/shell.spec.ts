import { expect, test } from "@playwright/test";

test("barra de coleta central, sem tabela, funciona nos dois temas e no mobile", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => { if (["error", "warning"].includes(message.type())) errors.push(message.text()); });
  await page.addInitScript(() => localStorage.setItem("pharmaleads-supabase-session", JSON.stringify({ access_token: "test", refresh_token: "test", expires_at: Date.now() + 3600000 })));
  let included = false;
  let status = "Não contatado";
  await page.route("**/auth/v1/user", route => route.fulfill({ json: { id: "677ed1e4-3e73-4f2c-951f-e77386f305da" } }));
  await page.route("**/rest/v1/pharmaleads?**", route => {
    if (route.request().method() === "PATCH") {
      included = route.request().postDataJSON().crm_included;
      status = route.request().postDataJSON().crm_status;
    }
    return route.fulfill({ json: [{ chave: "lead-real", nome: "Farmácia da base", local_busca: "Curitiba, PR", segmento: "varejo", crm_included: included, crm_status: status }], headers: { "content-range": "0-0/1" } });
  });
  await page.route("**/api/collector", route => route.fulfill({ json: route.request().method() === "POST" ? { run: { id: 0, status: "queued", url: "https://example.test/actions" } } : { run: null } }));
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
  const request = page.waitForRequest(req => req.url().endsWith("/api/collector") && req.method() === "POST");
  await page.getByRole("button", { name: "Pesquisar", exact: true }).click();
  expect((await request).postDataJSON()).toMatchObject({ action: "start", locais: "Curitiba, PR", segmentos: ["varejo"] });
  await page.getByRole("button", { name: "Ver leads", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Leads – Farmácias" })).toBeVisible();
  await page.getByRole("button", { name: "Nova Prospecção", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Encontre novas farmácias" })).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "CRM", exact: true }).click();
  await page.getByRole("button", { name: "Adicionar leads", exact: true }).click();
  await page.getByRole("button", { name: "Adicionar Farmácia da base ao CRM", exact: true }).click();
  await expect(page.getByRole("button", { name: "Adicionar Farmácia da base ao CRM", exact: true })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(page.getByText("Farmácia da base", { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});


test("login protege o painel, é responsivo e configurações não pedem conexão ao banco", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  let platformCalls = 0;
  await page.route("**/auth/v1/token?**", route => route.fulfill({ json: { access_token: "test", refresh_token: "test", expires_in: 3600, user: { id: "677ed1e4-3e73-4f2c-951f-e77386f305da", email: "cliente@example.com" } } }));
  await page.route("**/auth/v1/user", route => route.fulfill({ json: { id: "677ed1e4-3e73-4f2c-951f-e77386f305da" } }));
  await page.route("**/api/collector", route => { platformCalls += 1; return route.fulfill({ json: { run: null } }); });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Acesse sua plataforma" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Leads", exact: true })).toHaveCount(0);
  expect(platformCalls).toBe(0);
  for (const width of [360, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await expect(page.getByRole("button", { name: "Entrar", exact: true })).toBeVisible();
  }
  await page.screenshot({ path: test.info().outputPath("login-plataforma.png"), fullPage: true });
  await page.getByLabel("E-mail", { exact: true }).fill("cliente@example.com");
  await page.getByLabel("Senha", { exact: true }).fill("senha-de-teste");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Encontre novas farmácias" })).toBeVisible();
  await page.getByRole("button", { name: "Configurações", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Conectado");
  await expect(page.getByLabel("Senha", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Menu do usuário", exact: true }).click();
  await page.getByRole("menuitem", { name: "Sair da plataforma", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Acesse sua plataforma" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Acesse sua plataforma" })).toBeVisible();
  expect(errors).toEqual([]);
});
