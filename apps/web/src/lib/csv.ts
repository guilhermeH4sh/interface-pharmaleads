import type { LeadItem } from "./mock-leads";
import { parseLeadEmails } from "./email";

/** Evita injeção de fórmulas em planilhas e escapa aspas. */
const cell = (value: unknown) => {
  const raw = String(value ?? "");
  const safe = /^[\s]*[=+@-]/.test(raw) ? `'${raw}` : raw;
  return `"${safe.replaceAll('"', '""')}"`;
};

const COLUMNS: [string, (lead: LeadItem) => unknown][] = [
  ["Farmácia", (l) => l.nome],
  ["CNPJ", (l) => l.cnpj],
  ["Cidade", (l) => l.cidade],
  ["UF", (l) => l.uf],
  ["Bairro", (l) => l.bairro],
  ["Telefone", (l) => l.telefone],
  ["Status", (l) => l.status],
  ["E-mail", (l) => parseLeadEmails(l.email).join(", ")],
  ["Origem", (l) => l.origem],
  ["Endereço", (l) => l.endereco],
];

/** Gera e baixa um CSV (UTF-8 com BOM, separador ";", compatível com Excel pt-BR). */
const header = "\uFEFF" + COLUMNS.map(([name]) => cell(name)).join(";");
const csvRows = (leads: LeadItem[]) => leads.map(lead => COLUMNS.map(([, get]) => cell(get(lead))).join(";")).join("\r\n");

function downloadCsvParts(parts: string[], filename: string) {
  const url = URL.createObjectURL(new Blob(parts, { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `${filename}_${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadLeadsCsv(leads: LeadItem[], filename = "pharmaleads") {
  downloadCsvParts([header, "\r\n", csvRows(leads)], filename);
}

export async function downloadLeadPagesCsv(pages: AsyncIterable<LeadItem[]>, filename: string) {
  const parts = [header];
  for await (const leads of pages) {
    if (leads.length) parts.push("\r\n", csvRows(leads));
  }
  if (parts.length === 1) return false;
  downloadCsvParts(parts, filename);
  return true;
}

