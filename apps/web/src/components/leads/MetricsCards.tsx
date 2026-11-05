import { Users, CheckCircle, Phone, Store, type LucideIcon } from "lucide-react";
import { formatNumberBR } from "../../lib/formatters";
import { ui } from "../../lib/ui";
import { cn } from "../../lib/utils";
import type { LeadSummary } from "../../lib/mock-leads";

interface MetricsCardsProps {
  summary: LeadSummary;
  isLoading?: boolean;
}

export function MetricsCards({ summary, isLoading = false }: MetricsCardsProps) {
  const cards: { label: string; value: number; icon: LucideIcon; highlight?: boolean }[] = [
    { label: "Leads encontrados", value: summary.totalLeads, icon: Users, highlight: true },
    { label: "Qualificados", value: summary.qualificados, icon: CheckCircle },
    { label: "Em contato", value: summary.emContato, icon: Phone },
    { label: "Estados", value: summary.estados, icon: Store },
  ];

  return (
    <section aria-label="Resumo dos leads" className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {cards.map(({ label, value, icon: Icon, highlight }) => (
        <article key={label} className={cn(ui.cardInteractive, "p-5 flex items-center gap-4 group")}>
          {/* Ícone em círculo de 56px */}
          <div
            className={cn(
              "w-14 h-14 rounded-full flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-105",
              highlight ? "bg-primary text-primary-foreground shadow-[var(--shadow-primary)]" : "bg-primary-soft text-brand"
            )}
          >
            <Icon size={24} aria-hidden="true" />
          </div>
          <div className="min-w-0">
            {isLoading ? (
              <div className="h-8 w-24 rounded-md bg-muted animate-pulse" />
            ) : (
              <p className="text-2xl md:text-[28px] leading-tight font-extrabold tracking-tight text-foreground tabular-nums">
                {formatNumberBR(value)}
              </p>
            )}
            <p className="text-sm text-muted-foreground mt-0.5">{label}</p>
          </div>
        </article>
      ))}
    </section>
  );
}
