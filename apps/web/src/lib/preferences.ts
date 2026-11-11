const KEY = "pharmaleads-preferences";
export type Preferences = { pageSize: 5 | 10 | 25 | 50 };
const DEFAULTS: Preferences = { pageSize: 10 };

export function getPreferences(): Preferences {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) || "null") as Partial<Preferences> | null;
    const pageSize = value?.pageSize;
    return { pageSize: pageSize === 5 || pageSize === 25 || pageSize === 50 ? pageSize : DEFAULTS.pageSize };
  } catch {
    return DEFAULTS;
  }
}

export function savePreferences(value: Preferences): void {
  try { localStorage.setItem(KEY, JSON.stringify(value)); } catch { /* configuração permanece nesta sessão */ }
  window.dispatchEvent(new Event("pharmaleads-preferences-change"));
}
