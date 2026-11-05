import { cn } from "../../lib/utils";
import type { LeadStatus } from "../../lib/mock-leads";

/** Status usando apenas preto, roxo e branco (intensidade comunica a etapa do funil). */
const STATUS_STYLES: Record<LeadStatus, string> = {
  Qualificado: "bg-primary text-primary-foreground border-primary",
  Respondido: "bg-primary-soft text-brand border-primary/30",
  "Em contato": "bg-foreground text-background border-foreground",
  "Não contatado": "bg-muted text-muted-foreground border-border",
};

export function StatusBadge({ status, className }: { status: LeadStatus; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap px-2.5 py-1 rounded-full text-xs font-semibold border",
        STATUS_STYLES[status],
        className
      )}
    >
      {status}
    </span>
  );
}
