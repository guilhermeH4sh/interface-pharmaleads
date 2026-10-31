export const API = (import.meta.env.VITE_API_URL || "https://pharmaleads.onrender.com").replace(/\/$/, "");
const AUTH = "https://qxsdcrywsjkrpcbfgbxb.supabase.co/auth/v1";
export type Lead = { id: number; nome: string; razao_social: string | null; cnpj: string; uf: string; cidade: string; status: string | null; responsavel: string | null; cnae: string | null; bairro: string | null; endereco: string | null };
export type Profile = { email: string; role: string; scopes: string[] };
export type Session = { token: string; profile: Profile };
export type Page = { items: Lead[]; next_after_id: number | null };

export async function request<T>(path: string, token: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${API}${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {}, signal });
  if (!response.ok) throw new Error(response.status === 401 ? "A API exige autenticação para consultar os leads do Supabase." : response.status === 403 ? "Seu perfil não tem acesso ao CRM. Solicite acesso ao administrador." : `Não foi possível consultar os leads (HTTP ${response.status}).`);
  return response.json() as Promise<T>;
}

export async function login(email: string, password: string, key: string): Promise<Session> {
  if (!/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)) throw new Error("Informe a chave publicável do projeto.");
  const response = await fetch(`${AUTH}/token?grant_type=password`, { method: "POST", headers: { apikey: key, "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
  if (!response.ok) throw new Error("Não foi possível entrar. Confira seu e-mail e senha.");
  const data = await response.json() as { access_token: string };
  const profile = await request<Profile>("/v1/me", data.access_token);
  return { token: data.access_token, profile };
}
