import { useMemo, useState, type DragEvent } from "react";
import {
  Calendar,
  MessageCircle,
  ArrowRight,
  ArrowLeft,
  TrendingUp,
  User,
  GripVertical,
  ChevronDown,
  Trash2,
  Plus,
} from "lucide-react";
import { buildWhatsAppLink, formatNumberBR } from "../../lib/formatters";
import { Modal } from "../ui/modal";
import { ui } from "../../lib/ui";
import { cn } from "../../lib/utils";
import type { LeadItem, LeadStatus } from "../../lib/mock-leads";

interface CrmTabProps {
  leads: LeadItem[];
  availableLeads?: LeadItem[];
  onAddToCrm?: (id: string) => Promise<void>;
  searchQuery?: string;
  onStatusChange: (id: string, newStatus: LeadStatus) => void;
  onRemoveFromCrm: (id: string) => void;
  onSelectLead: (lead: LeadItem) => void;
  errorMessage?: string;
}

const COLUMNS: { id: LeadStatus; title: string; dotClass: string }[] = [
  { id: "Não contatado", title: "Não Contatado", dotClass: "bg-muted-foreground" },
  { id: "Em contato", title: "Em Contato", dotClass: "bg-foreground" },
  { id: "Respondido", title: "Respondido", dotClass: "bg-brand/70" },
  { id: "Qualificado", title: "Qualificado", dotClass: "bg-primary" },
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
}: CrmTabProps) {
  const [addOpen, setAddOpen] = useState(false);
  const [addQuery, setAddQuery] = useState("");
  const [addingId, setAddingId] = useState<string | null>(null);
  const [addError, setAddError] = useState("");
  const candidates = useMemo(() => {
    const included = new Set(leads.map(lead => lead.id));
    const query = addQuery.trim().toLocaleLowerCase("pt-BR");
    return availableLeads.filter(lead => !included.has(lead.id) && !lead.crmIncluded &&
      `${lead.nome} ${lead.cidade} ${lead.uf}`.toLocaleLowerCase("pt-BR").includes(query));
  }, [availableLeads, leads, addQuery]);

  async function addLead(id: string) {
    if (!onAddToCrm || addingId) return;
    setAddingId(id);
    setAddError("");
    try { await onAddToCrm(id); }
    catch (error) { setAddError(error instanceof Error ? error.message : "Não foi possível adicionar o lead."); }
    finally { setAddingId(null); }
  }

  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<LeadStatus | null>(null);
  const [limits, setLimits] = useState<Record<LeadStatus, number>>({
    "Não contatado": INITIAL_LIMIT,
    "Em contato": INITIAL_LIMIT,
    Respondido: INITIAL_LIMIT,
    Qualificado: INITIAL_LIMIT,
  });

  // Filtra leads pela busca da Topbar quando preenchida
  const filteredLeads = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return leads;
    return leads.filter((l) =>
      `${l.nome} ${l.cidade} ${l.uf} ${l.telefone} ${l.categoria || ""}`
        .toLowerCase()
        .includes(q)
    );
  }, [leads, searchQuery]);

  // Agrupa leads por coluna ordenando os movidos recentemente primeiro
  const groupedByCol = useMemo(() => {
    const groups: Record<LeadStatus, LeadItem[]> = {
      "Não contatado": [],
      "Em contato": [],
      Respondido: [],
      Qualificado: [],
    };
    for (const lead of filteredLeads) {
      const st = groups[lead.status] ? lead.status : "Não contatado";
      groups[st].push(lead);
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

  const handleDragOverColumn = (e: DragEvent<HTMLDivElement>, colId: LeadStatus) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverCol !== colId) {
      setDragOverCol(colId);
    }
  };

  const handleDropOnColumn = (e: DragEvent<HTMLDivElement>, targetStatus: LeadStatus) => {
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

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Adicionar leads ao CRM" description="Escolha contatos já salvos na sua base." size="lg">
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
                      : col.id === "Não contatado"
                        ? "Adicione leads pelo menu de ações na lista de Leads."
                        : "Arraste um lead para esta etapa."}
                  </div>
                ) : (
                  <>
                    {visibleLeads.map((lead) => {
                      const isDragging = draggedId === lead.id;
                      const whatsappUrl =
                        lead.whatsappLink || buildWhatsAppLink(lead.telefone);
                      const prevCol = colIndex > 0 ? COLUMNS[colIndex - 1].id : null;
                      const nextCol =
                        colIndex < COLUMNS.length - 1 ? COLUMNS[colIndex + 1].id : null;

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

                          <div className="mt-3 pt-2.5 border-t border-border flex items-center justify-between text-xs pl-1">
                            <span className="text-[11px] text-muted-foreground flex items-center gap-1 truncate">
                              <User size={11} className="shrink-0" />{" "}
                              {lead.responsavel || "Comercial"}
                            </span>

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
