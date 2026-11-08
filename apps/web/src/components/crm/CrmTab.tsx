import { useMemo, useState, type DragEvent } from "react";
import {
  Calendar,
  MessageCircle,
  ArrowRight,
  ArrowLeft,
  TrendingUp,
  GripVertical,
  ChevronDown,
  Trash2,
  Plus,
} from "lucide-react";
import { buildWhatsAppLink, formatNumberBR } from "../../lib/formatters";
import { Modal } from "../ui/modal";
import { ui } from "../../lib/ui";
import { cn } from "../../lib/utils";
import { buildDynamicLocations, filterLeadItems } from "../../lib/backend";
import { FiltersSidebar, type SideFilters } from "../leads/FiltersSidebar";
import type { LeadItem, LeadStatus } from "../../lib/mock-leads";

interface CrmTabProps {
  leads: LeadItem[];
  availableLeads?: LeadItem[];
  onAddToCrm?: (id: string) => Promise<boolean>;
  searchQuery?: string;
  onStatusChange: (id: string, newStatus: LeadStatus) => void;
  onRemoveFromCrm: (id: string) => void;
  onSelectLead: (lead: LeadItem) => void;
  errorMessage?: string;
  initialFilters?: SideFilters;
}

type CrmStage = Exclude<LeadStatus, "Não contatado">;

const COLUMNS: { id: CrmStage; title: string; dotClass: string }[] = [
  { id: "Em contato", title: "Em Contato", dotClass: "bg-foreground" },
  { id: "Respondido", title: "Respondido", dotClass: "bg-brand/70" },
  { id: "Qualificado", title: "Qualificado", dotClass: "bg-primary" },
  { id: "Não qualificado", title: "Não Qualificado", dotClass: "bg-muted-foreground" },
];

const INITIAL_LIMIT = 30;

export function CrmTab({
  leads,
  availableLeads = [],
  onAddToCrm,
  searchQuery = "",
  onStatusChange,
  onRemoveFromCrm,
  onSelectLead,
  errorMessage = "",
  initialFilters,
}: CrmTabProps) {
  const [filters, setFilters] = useState<SideFilters>(initialFilters ?? {
    uf: "", municipio: "", bairro: "", statusSelect: "Todos os status", origem: "Todas as origens", emailAvailability: "todos",
  });
  const [crmQuery, setCrmQuery] = useState(searchQuery);
  const dynamicLocations = useMemo(() => buildDynamicLocations(leads), [leads]);
  const availableOrigins = useMemo(() => [...new Set(leads.map(lead => lead.origem))].sort(), [leads]);
  const [addOpen, setAddOpen] = useState(false);
  const [addQuery, setAddQuery] = useState("");
  const [addingId, setAddingId] = useState<string | null>(null);
  const [addError, setAddError] = useState("");
  const candidates = useMemo(() => {
    const included = new Set(leads.map(lead => lead.id));
    const query = addQuery.trim().toLocaleLowerCase("pt-BR");
    return availableLeads.filter(lead => !included.has(lead.id) &&
      `${lead.nome} ${lead.cidade} ${lead.uf}`.toLocaleLowerCase("pt-BR").includes(query));
  }, [availableLeads, leads, addQuery]);

  async function addLead(id: string) {
    if (!onAddToCrm || addingId) return;
    setAddingId(id);
    setAddError("");
    try {
      if (!await onAddToCrm(id)) setAddError("Não foi possível adicionar o lead ao CRM.");
    }
    catch (error) { setAddError(error instanceof Error ? error.message : "Não foi possível adicionar o lead."); }
    finally { setAddingId(null); }
  }

  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<CrmStage | null>(null);
  const [limits, setLimits] = useState<Record<CrmStage, number>>({
    "Em contato": INITIAL_LIMIT,
    Respondido: INITIAL_LIMIT,
    Qualificado: INITIAL_LIMIT,
    "Não qualificado": INITIAL_LIMIT,
  });

  // Os mesmos critérios usados em Leads consultam apenas os contatos do CRM.
  const filteredLeads = useMemo(() => {
    return filterLeadItems(leads, {
      query: crmQuery, uf: filters.uf, municipio: filters.municipio, bairro: filters.bairro,
      statusSelect: filters.statusSelect, origem: filters.origem, emailAvailability: filters.emailAvailability,
    });
  }, [leads, crmQuery, filters]);

  // Agrupa leads por coluna ordenando os movidos recentemente primeiro
  const groupedByCol = useMemo(() => {
    const groups: Record<CrmStage, LeadItem[]> = {
      "Em contato": [],
      Respondido: [],
      Qualificado: [],
      "Não qualificado": [],
    };
    for (const lead of filteredLeads) {
      if (lead.status !== "Não contatado") groups[lead.status].push(lead);
    }
    for (const col of COLUMNS) {
      groups[col.id].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    }
    return groups;
  }, [filteredLeads]);

  const qualificadosCount = groupedByCol["Qualificado"].length;
  const taxaQualificacao =
    filteredLeads.length > 0 && qualificadosCount > 0
      ? `${((qualificadosCount / filteredLeads.length) * 100).toFixed(1).replace(/\.0$/, "")}%`
      : "0%";

  // Handlers de Drag & Drop nativo com cursor
  const handleDragStart = (e: DragEvent<HTMLDivElement>, lead: LeadItem) => {
    setDraggedId(lead.id);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", lead.id);
  };

  const handleDragEnd = () => {
    setDraggedId(null);
    setDragOverCol(null);
  };

  const handleDragOverColumn = (e: DragEvent<HTMLDivElement>, colId: CrmStage) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverCol !== colId) {
      setDragOverCol(colId);
    }
  };

  const handleDropOnColumn = (e: DragEvent<HTMLDivElement>, targetStatus: CrmStage) => {
    e.preventDefault();
    const idFromTransfer = e.dataTransfer.getData("text/plain") || draggedId;
    setDragOverCol(null);
    setDraggedId(null);
    if (!idFromTransfer) return;

    const lead = leads.find((l) => l.id === idFromTransfer);
    if (lead && lead.status !== targetStatus) {
      onStatusChange(idFromTransfer, targetStatus);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className={cn(ui.pageTitle, "flex items-center gap-2.5")}>
            <Calendar className="text-brand" size={24} />
            <span>Pipeline Comercial & Funil CRM</span>
          </h2>
          <p className={ui.pageSubtitle}>
            Adicione leads da sua base e arraste os cards entre as etapas. Remover do CRM devolve o contato à aba Leads.
          </p>
        </div>

        {/* Indicadores do Funil */}
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={() => setAddOpen(true)} disabled={!onAddToCrm} className={cn(ui.btnBrand, "h-11 px-5")}><Plus size={18} />Adicionar leads</button>
          <div className={cn(ui.card, "px-4 py-2.5 flex items-center gap-2 text-xs")}>
            <TrendingUp size={16} className="text-brand" />
            <span className="text-muted-foreground">Taxa de Qualificação:</span>
            <span className="font-bold text-foreground tabular-nums">{taxaQualificacao}</span>
          </div>
        </div>
      </div>

      {errorMessage && (
        <div role="alert" className="rounded-xl border border-border bg-surface px-4 py-3 text-sm text-foreground">
          {errorMessage}
        </div>
      )}

      <div className={cn(ui.card, "p-4 md:p-6 space-y-4")}>
        <input type="search" aria-label="Pesquisar no CRM" placeholder="Pesquisar no CRM" value={crmQuery} onChange={event => setCrmQuery(event.target.value)} className={cn(ui.input, "max-w-md")} />
        <FiltersSidebar
          key={`${filters.uf}|${filters.municipio}|${filters.bairro}|${filters.statusSelect}|${filters.origem}|${filters.emailAvailability}`}
          selectedUF={filters.uf} selectedMunicipio={filters.municipio} selectedBairro={filters.bairro}
          selectedStatus={filters.statusSelect} selectedOrigem={filters.origem} selectedEmailAvailability={filters.emailAvailability}
          onApplyFilters={setFilters}
          onResetFilters={() => setFilters({ uf: "", municipio: "", bairro: "", statusSelect: "Todos os status", origem: "Todas as origens", emailAvailability: "todos" })}
          dynamicLocations={dynamicLocations} availableOrigins={availableOrigins}
          statusOptions={["Em contato", "Respondido", "Qualificado", "Não qualificado"]}
        />
        <p className="text-xs text-muted-foreground">{filteredLeads.length} de {leads.length} leads no CRM</p>
      </div>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Adicionar leads ao CRM" description="Ao adicionar, o contato entra na etapa Em contato." size="lg">
        <div className="space-y-4">
          <input type="search" aria-label="Pesquisar leads para o CRM" placeholder="Pesquisar nome, cidade ou UF" value={addQuery} onChange={event => setAddQuery(event.target.value)} className={ui.input} />
          {(addError || errorMessage) && <p role="alert" className="text-sm">{addError || errorMessage}</p>}
          <ul className="space-y-2">
            {candidates.slice(0, 30).map(lead => (
              <li key={lead.id} className="flex items-center justify-between gap-3 rounded-xl border border-border p-3">
                <div className="min-w-0"><p className="font-semibold truncate">{lead.nome}</p><p className="text-sm text-muted-foreground">{lead.cidade} / {lead.uf}</p></div>
                <button type="button" aria-label={`Adicionar ${lead.nome} ao CRM`} disabled={Boolean(addingId)} onClick={() => void addLead(lead.id)} className={cn(ui.btnSecondary, "h-10 px-3 shrink-0")}>{addingId === lead.id ? "Salvando..." : "Adicionar"}</button>
              </li>
            ))}
          </ul>
          {!candidates.length && <p className="text-sm text-muted-foreground">Nenhum lead disponível para adicionar.</p>}
          {candidates.length > 30 && <p className="text-sm text-muted-foreground">Exibindo 30 de {candidates.length} contatos. Refine a pesquisa para encontrar um lead.</p>}
        </div>
      </Modal>

      {/* Kanban Board com 4 colunas (Drop Zones) */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5 items-start">
        {COLUMNS.map((col, colIndex) => {
          const colLeads = groupedByCol[col.id];
          const limit = limits[col.id] || INITIAL_LIMIT;
          const visibleLeads = colLeads.slice(0, limit);
          const hasMore = colLeads.length > limit;
          const isDropTarget = dragOverCol === col.id;

          return (
            <div
              key={col.id}
              onDragOver={(e) => handleDragOverColumn(e, col.id)}
              onDragEnter={(e) => handleDragOverColumn(e, col.id)}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
                  setDragOverCol((curr) => (curr === col.id ? null : curr));
                }
              }}
              onDrop={(e) => handleDropOnColumn(e, col.id)}
              aria-label={`Coluna ${col.title}`}
              className={cn(
                ui.card,
                "p-4 flex flex-col min-h-[540px] transition-all duration-150",
                isDropTarget &&
                  "border-primary bg-primary-soft/35 ring-2 ring-primary/25 scale-[1.01]"
              )}
            >
              {/* Topo da Coluna */}
              <div className="flex items-center justify-between pb-3 border-b border-border mb-3">
                <div className="flex items-center gap-2">
                  <span className={cn("w-2.5 h-2.5 rounded-full", col.dotClass)} />
                  <h3 className="font-bold text-sm text-foreground">{col.title}</h3>
                </div>
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-surface text-muted-foreground border border-border tabular-nums">
                  {formatNumberBR(colLeads.length)}
                </span>
              </div>

              {/* Lista de Cards Arrastáveis */}
              <div className="flex flex-col gap-3 flex-1 overflow-y-auto max-h-[650px] pr-1">
                {colLeads.length === 0 ? (
                  <div
                    className={cn(
                      "p-6 text-center text-xs text-muted-foreground border border-dashed rounded-xl my-auto transition-colors",
                      isDropTarget
                        ? "border-primary text-brand font-semibold bg-primary-soft/50"
                        : "border-border"
                    )}
                  >
                    {isDropTarget
                      ? `Soltar aqui para mover para "${col.title}"`
                      : "Arraste um lead para esta etapa."}
                  </div>
                ) : (
                  <>
                    {visibleLeads.map((lead) => {
                      const isDragging = draggedId === lead.id;
                      const whatsappUrl =
                        lead.whatsappLink || buildWhatsAppLink(lead.telefone);
                      const prevCol = colIndex > 0 && colIndex < 3 ? COLUMNS[colIndex - 1].id : null;
                      const nextCol = colIndex < 2 ? COLUMNS[colIndex + 1].id : null;

                      return (
                        <div
                          key={lead.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, lead)}
                          onDragEnd={handleDragEnd}
                          onClick={() => {
                            if (!draggedId) onSelectLead(lead);
                          }}
                          className={cn(
                            "p-3.5 rounded-xl bg-surface border border-border hover:border-primary/50 hover:shadow-[var(--shadow-card)] transition-all cursor-grab active:cursor-grabbing select-none group",
                            isDragging && "opacity-40 scale-95 border-primary border-dashed"
                          )}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-start gap-1.5 min-w-0">
                              <GripVertical
                                size={15}
                                className="text-muted-foreground/60 group-hover:text-brand shrink-0 mt-0.5"
                                aria-hidden="true"
                              />
                              <h4 className="font-bold text-sm text-foreground group-hover:text-brand transition-colors line-clamp-1">
                                {lead.nome}
                              </h4>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-semibold">
                                {lead.uf}
                              </span>
                              <button
                                type="button"
                                aria-label={`Remover ${lead.nome} do CRM`}
                                title="Remover do CRM (mantém o lead na base)"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  onRemoveFromCrm(lead.id);
                                }}
                                className="w-7 h-7 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-brand hover:bg-primary-soft transition-colors"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>

                          <p className="text-xs text-muted-foreground mt-1 pl-5 line-clamp-1">
                            {lead.cidade} · {lead.categoria || "Drogaria"}
                          </p>

                          <div className="mt-3 pt-2.5 border-t border-border flex items-center justify-end text-xs pl-1">
                            <a
                              href={whatsappUrl}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="p-1.5 rounded-lg bg-primary-soft text-brand hover:bg-primary hover:text-primary-foreground transition-colors shrink-0"
                              title="Abrir no WhatsApp"
                            >
                              <MessageCircle size={13} />
                            </a>
                          </div>

                          {/* Atalhos Rápidos de Mover Etapa (Voltar / Avançar) */}
                          <div className="mt-2.5 pt-2 border-t border-border/60 flex items-center justify-between gap-1.5">
                            {prevCol ? (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onStatusChange(lead.id, prevCol);
                                }}
                                className="text-[11px] font-medium text-muted-foreground hover:text-foreground flex items-center gap-1"
                              >
                                <ArrowLeft size={11} /> Voltar
                              </button>
                            ) : (
                              <span />
                            )}

                            {nextCol && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onStatusChange(lead.id, nextCol);
                                }}
                                className="text-[11px] font-semibold text-brand hover:underline flex items-center gap-1 ml-auto"
                              >
                                Avançar etapa <ArrowRight size={11} />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    {hasMore && (
                      <button
                        type="button"
                        onClick={() =>
                          setLimits((curr) => ({
                            ...curr,
                            [col.id]: (curr[col.id] || INITIAL_LIMIT) + INITIAL_LIMIT,
                          }))
                        }
                        className={cn(
                          ui.btnSecondary,
                          "w-full h-10 text-xs font-semibold shrink-0 mt-1"
                        )}
                      >
                        <ChevronDown size={14} />
                        Mostrar mais ({formatNumberBR(colLeads.length - limit)} restantes)
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
