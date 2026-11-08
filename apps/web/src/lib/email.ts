export type EmailAvailability = "todos" | "com" | "sem";

export function parseLeadEmails(value?: string): string[] {
  const seen = new Set<string>();
  return (value || "")
    .split(/[,;\s]+/)
    .map((email) => email.trim())
    .filter((email) => {
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return false;
      const normalized = email.toLowerCase();
      if (seen.has(normalized)) return false;
      seen.add(normalized);
      return true;
    });
}
