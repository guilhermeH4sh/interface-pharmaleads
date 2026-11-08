"use strict";

// Lê sites de leads existentes e salva candidatos com a página de origem.
// Não acessa o Supabase nem grava e-mails nos leads.
const fs = require("node:fs");
const path = require("node:path");
const dns = require("node:dns").promises;
const { chromium } = require("../apps/web/node_modules/@playwright/test");

const EMAIL = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const EXCLUIR = /^(?:no[._-]?reply|nao[._-]?responda|abuse|dpo|lgpd|privacidade|postmaster)@/i;
const OUTROS = /(?:^|\.)(?:sentry\.io|sentry-next\.wixpress\.com|mysite\.com|meusite\.com|example\.com|example\.org|example\.net|test\.com|invalid)$/i;
const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";

function hospedeiro(url) {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch (_) {
    return "";
  }
}

function ipPublico(ip) {
  const partes = ip.split(".").map(Number);
  if (partes.length !== 4 || partes.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return false;
  const [a, b, c] = partes;
  return !(a === 0 || a === 10 || a === 127 || a >= 224 ||
    a === 169 && b === 254 || a === 172 && b >= 16 && b <= 31 ||
    a === 192 && (b === 168 || b === 0 || b === 88 && c === 99) ||
    a === 100 && b >= 64 && b <= 127 ||
    a === 198 && (b === 18 || b === 19 || b === 51 && c === 100) ||
    a === 203 && b === 0 && c === 113);
}

const resolvidos = new Map();
async function destinoPublico(host) {
  if (!resolvidos.has(host)) {
    resolvidos.set(host, dns.lookup(host, { family: 4, all: true })
      .then((ips) => ips.length > 0 && ips.every((item) => ipPublico(item.address)))
      .catch(() => false));
  }
  return resolvidos.get(host);
}

function candidatos(texto, fonte, tipo) {
  return [...new Set((texto.match(EMAIL) || []).map((email) => email.toLowerCase()))]
    .filter((email) => !EXCLUIR.test(email) && !OUTROS.test(email.split("@")[1]))
    .map((email) => ({ email, fonte, tipo }));
}

function normalizar(texto) {
  return String(texto || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toUpperCase().replace(/[^A-Z0-9]+/g, " ").trim();
}

function enderecoNoTexto(item, texto) {
  const endereco = item.endereco?.startsWith(item.nome) ? item.endereco.slice(item.nome.length) : item.endereco;
  const trecho = endereco?.match(/(?:^|\s-\s)([^,]+),\s*(?:N[º°.]*\s*)?(\d{1,6})(?=\D|$)/i);
  if (!trecho) return false;
  const palavras = normalizar(trecho[1]).split(" ")
    .filter((p) => p.length >= 3 && !["RUA", "AVENIDA", "RODOVIA"].includes(p));
  if (palavras.length < 2) return false;
  const corpo = normalizar(texto);
  const rua = palavras.join(" ");
  const numero = String(Number(trecho[2]));
  const reNumero = new RegExp(`(?:^| )${numero}(?: |$)`);
  let posicao = corpo.indexOf(rua);
  while (posicao !== -1) {
    if (reNumero.test(corpo.slice(posicao + rua.length, posicao + rua.length + 50))) return true;
    posicao = corpo.indexOf(rua, posicao + 1);
  }
  return false;
}

async function examinar(browser, item) {
  const site = new URL(item.site);
  const host = hospedeiro(item.site);
  if (!["http:", "https:"].includes(site.protocol) || !host || !await destinoPublico(site.hostname)) {
    return { chave: item.chave, site: item.site, paginas: 0, candidatos: [], erro: "destino_indisponivel" };
  }
  const contexto = await browser.newContext({ serviceWorkers: "block", acceptDownloads: false });
  const pagina = await contexto.newPage();
  const achados = new Map();
  const fontesEndereco = [];
  const fila = [item.site];
  const vistos = new Set();
  let paginas = 0;
  await pagina.route("**/*", async (rota) => {
    try {
      const alvo = new URL(rota.request().url());
      if (!["http:", "https:"].includes(alvo.protocol) || hospedeiro(alvo.href) !== host ||
          ["image", "font", "media"].includes(rota.request().resourceType()) ||
          !await destinoPublico(alvo.hostname)) return rota.abort();
      return rota.continue();
    } catch (_) {
      return rota.abort();
    }
  });
  try {
    while (fila.length && paginas < 3) {
      const url = fila.shift();
      if (vistos.has(url)) continue;
      vistos.add(url);
      try {
        await pagina.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 });
        await pagina.waitForTimeout(1200);
        paginas++;
        const fonte = pagina.url();
        const texto = await pagina.locator("body").innerText({ timeout: 3000 });
        if (enderecoNoTexto(item, texto)) fontesEndereco.push(fonte);
        const mailtos = await pagina.locator('a[href^="mailto:"]').evaluateAll((links) =>
          links.map((link) => {
            try { return decodeURIComponent(link.getAttribute("href").slice(7).split("?")[0]).trim(); }
            catch (_) { return ""; }
          }));
        for (const contato of [...candidatos(texto, fonte, "visivel"),
          ...candidatos(mailtos.join(" "), fonte, "mailto")]) {
          achados.set(contato.email, contato);
        }
        if (paginas === 1) {
          const links = await pagina.locator("a[href]").evaluateAll((links) =>
            links.map((link) => link.href)
              .filter((url) => /contat|fale|atendimento|contact|nossas.lojas|unidades/i.test(url)));
          for (const link of links) {
            if (hospedeiro(link) === host && !fila.includes(link)) fila.push(link);
          }
        }
      } catch (_) {
        // Um site inacessível não interrompe os demais leads.
      }
    }
    return { chave: item.chave, site: item.site, paginas, candidatos: [...achados.values()],
      endereco_confirmado: fontesEndereco.length > 0, fontes_endereco: fontesEndereco };
  } finally {
    await contexto.close();
  }
}

async function main() {
  const entrada = process.argv[2] || "dados/fila_playwright_emails.json";
  const saida = process.argv[3] || "dados/candidatos_playwright_emails.jsonl";
  const limite = Number(process.argv[4] || 100);
  if (!Number.isInteger(limite) || limite < 1) throw new Error("Limite inválido.");
  const fila = JSON.parse(fs.readFileSync(entrada, "utf8"));
  const concluidos = new Set();
  if (fs.existsSync(saida)) {
    for (const linha of fs.readFileSync(saida, "utf8").split("\n")) {
      if (!linha.trim()) continue;
      try { concluidos.add(JSON.parse(linha).chave); } catch (_) {}
    }
  }
  const pendentes = fila.filter((item) => !concluidos.has(item.chave)).slice(0, limite);
  const browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_BROWSER_PATH || (fs.existsSync(EDGE) ? EDGE : undefined),
    headless: true,
  });
  let visitados = 0;
  let comCandidatos = 0;
  try {
    for (const item of pendentes) {
      const resultado = await examinar(browser, item);
      fs.appendFileSync(saida, JSON.stringify(resultado) + "\n", "utf8");
      visitados++;
      comCandidatos += resultado.candidatos.length > 0 ? 1 : 0;
      if (visitados % 10 === 0) {
        console.log(`${visitados}/${pendentes.length} examinados; ${comCandidatos} com candidatos.`, new Date().toISOString());
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  } finally {
    await browser.close();
  }
  console.log(`Concluídos nesta execução: ${visitados}; com candidatos: ${comCandidatos}.`);
}

if (require.main === module) {
  main().catch((erro) => { console.error(erro.message); process.exitCode = 1; });
}

module.exports = { hospedeiro, ipPublico, candidatos, enderecoNoTexto };
