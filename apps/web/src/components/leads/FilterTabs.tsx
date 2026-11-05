import { formatNumberBR } from "../../lib/formatters";
import { cn } from "../../lib/utils";
import type { LeadStatus, LeadSummary } from "../../lib/mock-leads";

interface FilterTabsProps {
  activeTab: "Todos" | LeadStatus;
  onTabChange: (tab: "Todos" | LeadStatus) => void;
  summary: LeadSummary;
}

export function FilterTabs({ activeTab, onTabChange, summary }: FilterTabsProps) {
  const tabs: { id: "Todos" | LeadStatus; count: number }[] = [
    { id: "Todos", count: summary.totalLeads },
    { id: "Não contatado", count: summary.naoContatados },
    { id: "Em contato", count: summary.emContato },
    { id: "Respondido", count: summary.respondidos },
    { id: "Qualificado", count: summary.qualificados },
  ];

  return (
    <div role="tablist" aria-label="Filtrar por status" className="flex items-center gap-2 overflow-x-auto scrollbar-none -mx-1 px-1 py-0.5">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onTabChange(tab.id)}
            className={cn(
              "whitespace-nowrap h-11 sm:h-10 px-4 rounded-full text-sm font-semibold border transition-all duration-200",
              isActive
                ? "bg-primary-soft text-brand border-primary"
                : "bg-card text-muted-foreground border-border hover:text-foreground hover:bg-muted"
            )}
          >
            {tab.id}
            <span className={cn("ml-1.5 tabular-nums font-medium", isActive ? "opacity-90" : "opacity-70")}>
              ({formatNumberBR(tab.count)})
            </span>
          </button>
        );
      })}
    </div>
  );
}
