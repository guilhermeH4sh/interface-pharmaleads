import type { LeadItem } from "./mock-leads";

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
  ["Responsável", (l) => l.responsavel],
  ["Origem", (l) => l.origem],
  ["Endereço", (l) => l.endereco],
];

/** Gera e baixa um CSV (UTF-8 com BOM, separador ";", compatível com Excel pt-BR). */
export function downloadLeadsCsv(leads: LeadItem[], filename = "pharmaleads") {
  const header = COLUMNS.map(([name]) => cell(name)).join(";");
  const rows = leads.map((lead) => COLUMNS.map(([, get]) => cell(get(lead))).join(";"));
  const csv = "\uFEFF" + [header, ...rows].join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `${filename}_${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

