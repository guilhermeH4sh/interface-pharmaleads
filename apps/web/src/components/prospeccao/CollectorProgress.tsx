import { LoaderCircle } from "lucide-react";
import { COLETA_ATIVA_STATES, type CollectorRun } from "../../lib/backend";

const stages: Record<string, string> = {
  queued: "Na fila",
  preparing: "Preparando a rodada",
  searching: "Buscando no Google Maps",
  retrying: "Repetindo a busca",
  importing: "Processando os resultados",
  enriching: "Buscando contatos nos sites",
  syncing: "Enviando leads ao Supabase",
};

export function CollectorProgress({ run, stale }: { run: CollectorRun; stale: boolean }) {
  const running = COLETA_ATIVA_STATES.includes(run.status) || run.status === "cancelling";
  const total = run.total_rounds ?? 0;
  const completed = run.completed_rounds ?? 0;
  const national = total > 1;
  const phase = run.status === "cancelling" ? "Parando coleta"
    : run.status === "completed"
      ? run.conclusion === "success" ? "Coleta concluída"
        : run.conclusion === "cancelled" ? "Coleta cancelada" : "A coleta falhou"
      : stages[run.stage ?? run.status] ?? "Coleta em andamento";
  const animated = running && !stale;

  return (
    <section aria-label="Progresso da coleta no Render" className="mt-6 space-y-3 rounded-xl border border-input bg-card p-4 text-sm">
      <div role="status" className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {animated && <LoaderCircle size={16} className="text-brand motion-safe:animate-spin" aria-hidden="true" />}
        <strong>{phase}</strong>
        {run.title && <span className="text-muted-foreground">{run.title}</span>}
        {stale && <span className="w-full text-muted-foreground">Último status recebido. Tentando reconectar ao Render.</span>}
      </div>
      {national ? (
        <>
          <div role="progressbar" aria-label="Rodadas concluídas" aria-valuemin={0} aria-valuemax={total} aria-valuenow={completed}
            className="h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary motion-safe:transition-[width] motion-safe:duration-500" style={{ width: `${100 * completed / total}%` }} />
          </div>
          <p className="text-muted-foreground">{completed} de {total} rodadas concluídas</p>
        </>
      ) : animated ? (
        <div role="progressbar" aria-label="Coleta em andamento" className="h-2 rounded-full bg-primary/40 motion-safe:animate-pulse" />
      ) : null}
      {run.synced_leads != null && (
        <p className="text-muted-foreground">{run.synced_leads.toLocaleString("pt-BR")} leads enviados ao Supabase nesta coleta</p>
      )}
    </section>
  );
}
