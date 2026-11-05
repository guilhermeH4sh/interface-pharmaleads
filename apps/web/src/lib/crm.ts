export type Lead = { chave: string; nome: string; segmento: string; categoria: string; endereco: string; local_busca: string; telefone: string; telefone_normalizado: string; celular: number; whatsapp_link: string; site: string; emails: string; situacao: string; avaliacao: string; qtd_avaliacoes: string; latitude: string; longitude: string; link: string; ultima_coleta?: string; crm_included?: boolean; crm_status?: string };
export type Page = { items: Lead[]; total: number; next_offset: number | null };
export type Segmento = { id: string; descricao: string };
export type Execucao = { id: number; estado: string; criado_em: string; terminado_em: string | null; total: number; concluidas: number; falhas: number; erro: string | null };
export type Status = { total_leads: number; sync_pendente?: number; execucao: Execucao | null; consulta_atual: string | null };

export async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(path, options);
  if (!response.ok) {
    const data = await response.json().catch(() => ({})) as { error?: string };
    throw new Error(data.error || `Erro na API local (HTTP ${response.status}).`);
  }
  return response.json() as Promise<T>;
}
