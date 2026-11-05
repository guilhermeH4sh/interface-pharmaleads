import { useState } from "react";
import { CheckSquare, UserPlus, Download, X } from "lucide-react";
import { ui } from "../../lib/ui";
import { cn } from "../../lib/utils";
import type { LeadStatus } from "../../lib/mock-leads";

interface BatchActionsBarProps {
  selectedCount: number;
  onClearSelection: () => void;
  onBatchStatusChange: (status: LeadStatus) => void;
  onBatchExportCSV: () => void;
  onBatchAssignResponsible: (responsible: string) => void;
}

const STATUSES: LeadStatus[] = ["Qualificado", "Em contato", "Respondido", "Não contatado"];
const RESPONSAVEIS = ["Comercial Centrus", "Guilherme Ferreira", "Equipe Vendas SP", "Time Hunter"];

export function BatchActionsBar({
  selectedCount,
  onClearSelection,
  onBatchStatusChange,
  onBatchExportCSV,
  onBatchAssignResponsible,
}: BatchActionsBarProps) {
  const [open, setOpen] = useState<"status" | "assign" | null>(null);

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

        <div className="relative">
          <button onClick={() => setOpen(open === "status" ? null : "status")} aria-expanded={open === "status"} className={cn(action, "hover:bg-background/10")}>
            <CheckSquare size={16} /> <span className="hidden sm:inline">Alterar status</span>
          </button>
          {open === "status" && (
            <div role="menu" className={cn(ui.menu, "absolute left-0 bottom-12 w-48 text-foreground")}>
              {STATUSES.map((st) => (
                <button key={st} role="menuitem" className={ui.menuItem} onClick={() => { onBatchStatusChange(st); setOpen(null); }}>
                  {st}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="relative">
          <button onClick={() => setOpen(open === "assign" ? null : "assign")} aria-expanded={open === "assign"} className={cn(action, "hover:bg-background/10")}>
            <UserPlus size={16} /> <span className="hidden sm:inline">Atribuir responsável</span>
          </button>
          {open === "assign" && (
            <div role="menu" className={cn(ui.menu, "absolute left-0 bottom-12 w-52 text-foreground")}>
              {RESPONSAVEIS.map((resp) => (
                <button key={resp} role="menuitem" className={ui.menuItem} onClick={() => { onBatchAssignResponsible(resp); setOpen(null); }}>
                  {resp}
                </button>
              ))}
            </div>
          )}
        </div>

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
