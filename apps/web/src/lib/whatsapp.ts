export type WhatsAppState = "confirmado" | "indisponivel";

export interface WhatsAppVerification {
  numero: string;
  estado: WhatsAppState;
  verificado_em: string;
}

export function normalizeWhatsAppNumber(phone?: string) {
  const digits = phone?.replace(/\D/g, "") ?? "";
  if (/^55[1-9]\d{9,10}$/.test(digits)) return digits;
  return /^[1-9]\d{9,10}$/.test(digits) ? `55${digits}` : undefined;
}

export function publishedWhatsAppNumber(link?: string) {
  if (!link) return undefined;
  try {
    const url = new URL(link);
    if (url.protocol !== "https:" || url.username || url.password) return undefined;
    if (url.hostname === "wa.me" && /^\/\d+\/?$/.test(url.pathname)) {
      return normalizeWhatsAppNumber(url.pathname);
    }
    if (["api.whatsapp.com", "web.whatsapp.com"].includes(url.hostname) && url.pathname === "/send") {
      return normalizeWhatsAppNumber(url.searchParams.get("phone") ?? undefined);
    }
  } catch {
    return undefined;
  }
}

export const whatsAppUrl = (number: string) => `https://wa.me/${number}`;
