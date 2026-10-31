export const API = (import.meta.env.VITE_API_URL || "https://pharmaleads.onrender.com").replace(/\/$/, "");
export type Lead = { id: number; nome: string; razao_social: string | null; cnpj: string; uf: string; cidade: string; status: string | null; responsavel: string | null; cnae: string | null; bairro: string | null; endereco: string | null };
export type Page = { items: Lead[]; next_after_id: number | null };

export async function request<T>(path: string, token: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${API}${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {}, signal });
  if (!response.ok) throw new Error(response.status === 401 ? "A API exige autenticação para consultar os leads do Supabase." : response.status === 403 ? "Seu perfil não tem acesso ao CRM. Solicite acesso ao administrador." : `Não foi possível consultar os leads (HTTP ${response.status}).`);
  return response.json() as Promise<T>;
}
