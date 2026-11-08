"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { hospedeiro, ipPublico, candidatos, enderecoNoTexto } = require("./scan_playwright_emails.cjs");

test("bloqueia endereços locais e reservados antes de abrir o navegador", () => {
  for (const ip of ["127.0.0.1", "10.1.2.3", "172.16.0.5", "192.168.1.2", "169.254.1.2", "100.64.0.1", "203.0.113.7"]) {
    assert.equal(ipPublico(ip), false, ip);
  }
  assert.equal(ipPublico("8.8.8.8"), true);
  assert.equal(hospedeiro("https://www.exemplo.com/contato"), "exemplo.com");
});

test("candidatos excluem e-mails técnicos da página", () => {
  const itens = candidatos("contato@farmacia.com.br sentry@sentry.io no-reply@farmacia.com.br info@mysite.com info@example.com", "https://farmacia.com.br", "visivel");
  assert.deepEqual(itens.map((item) => item.email), ["contato@farmacia.com.br"]);
});

test("confirma rua e número juntos e rejeita outro número", () => {
  const lead = {
    nome: "Manipularium Fórmulas Farmacêuticas",
    endereco: "Manipularium Fórmulas Farmacêuticas - R. Eliseu Guilherme, 1034 - Ribeirão Preto - SP",
  };
  assert.equal(enderecoNoTexto(lead, "Nossa loja: Rua Eliseu Guilherme, 1034, Ribeirão Preto."), true);
  assert.equal(enderecoNoTexto(lead, "Nossa loja: Rua Eliseu Guilherme, 300, Ribeirão Preto."), false);
});
