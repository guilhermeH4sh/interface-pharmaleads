/**
 * Formatadores utilitários para CNPJ, Telefone, Moeda e links
 */

export function formatCNPJ(value: string | null | undefined): string {
  if (!value) return "Não informado";
  const clean = value.replace(/\D/g, "");
  if (clean.length !== 14) return value;
  return clean.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}

export function formatPhone(value: string | null | undefined): string {
  if (!value) return "Não informado";
  const clean = value.replace(/\D/g, "");
  if (clean.length === 11) {
    return clean.replace(/^(\d{2})(\d{5})(\d{4})$/, "($1) $2-$3");
  }
  if (clean.length === 10) {
    return clean.replace(/^(\d{2})(\d{4})(\d{4})$/, "($1) $2-$3");
  }
  return value;
}

export function formatNumberBR(value: number): string {
  return new Intl.NumberFormat("pt-BR").format(value);
}
