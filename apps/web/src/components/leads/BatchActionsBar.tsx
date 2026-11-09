import { BriefcaseBusiness, Download, X } from "lucide-react";
import { cn } from "../../lib/utils";

interface BatchActionsBarProps {
  selectedCount: number;
  onClearSelection: () => void;
  onBatchAddToCrm: () => void;
  onBatchExportCSV: () => void;
}

export function BatchActionsBar({
  selectedCount,
  onClearSelection,
  onBatchAddToCrm,
  onBatchExportCSV,
}: BatchActionsBarProps) {
  if (selectedCount === 0) return null;

  const action = "h-10 px-3 inline-flex items-center gap-2 rounded-lg text-sm font-semibold transition-colors";

  return (
    <div
      role="region"
      aria-label="Ações em lote"
      className="fixed left-1/2 bottom-[max(1.25rem,env(safe-area-inset-bottom))] z-40 w-[calc(100%-2rem)] sm:w-auto animate-rise-in"
      style={{ transform: "translateX(-50%)" }}
    >
      <div className="flex items-center gap-1.5 sm:gap-2 rounded-2xl bg-foreground text-background p-2 pl-3 shadow-[var(--shadow-pop)]">
        <span className="flex items-center gap-2 pr-2 mr-1 border-r border-background/20 text-sm font-semibold whitespace-nowrap">
          <span className="min-w-6 h-6 px-1.5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center tabular-nums">
            {selectedCount}
          </span>
          <span className="hidden sm:inline">selecionados</span>
        </span>

        <button onClick={onBatchAddToCrm} className={cn(action, "hover:bg-background/10")}>
          <BriefcaseBusiness size={16} /> <span className="hidden sm:inline">Adicionar ao CRM</span>
        </button>

        <button onClick={onBatchExportCSV} className={cn(action, "bg-primary text-primary-foreground hover:bg-primary-hover")}>
          <Download size={16} /> <span className="hidden sm:inline">Exportar CSV</span>
        </button>

        <button onClick={onClearSelection} aria-label="Cancelar seleção" className="ml-auto sm:ml-1 w-10 h-10 inline-flex items-center justify-center rounded-lg hover:bg-background/10">
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
