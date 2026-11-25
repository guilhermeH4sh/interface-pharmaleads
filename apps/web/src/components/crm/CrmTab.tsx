import { memo, useMemo, useState, useCallback, useRef, useEffect } from "react";
import {
  DndContext,
  DragOverlay,
  useSensors,
  useSensor,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  closestCorners,
  pointerWithin,
  rectIntersection,
  getFirstCollision,
  useDroppable,
  defaultDropAnimationSideEffects,
  type Announcements,
  type CollisionDetection,
  type DropAnimation,
  type DragStartEvent,
  type DragOverEvent,
  type DragEndEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { motion, AnimatePresence } from "motion/react";
import {
  Calendar,
  TrendingUp,
  ChevronDown,
  Plus,
} from "lucide-react";
import { formatNumberBR } from "../../lib/formatters";
import { Modal } from "../ui/modal";
import { Toast, type ToastMessage } from "../ui/toast";
import { ui } from "../../lib/ui";
import { cn } from "../../lib/utils";
import {
  springPhysics,
  motionGestures,
  usePrefersReducedMotion,
} from "../../lib/motion";
import { KanbanCard, type CrmStage } from "./KanbanCard";
import type { LeadItem, LeadStatus } from "../../lib/mock-leads";

interface CrmTabProps {
  leads: LeadItem[];
  availableLeads?: LeadItem[];
  searchCandidates?: (query: string, signal: AbortSignal) => Promise<LeadItem[]>;
  searchQuery?: string;
  onAddToCrm?: (id: string) => Promise<boolean>;
  onStatusChange: (id: string, newStatus: LeadStatus) => Promise<boolean> | void;
  onRemoveFromCrm: (id: string) => void;
  onSelectLead: (lead: LeadItem) => void;
  errorMessage?: string;
  toastMessage?: ToastMessage | null;
  onDismissToast?: () => void;
}

const COLUMNS: { id: CrmStage; title: string; dotClass: string }[] = [
  { id: "Em contato", title: "Em Contato", dotClass: "bg-foreground" },
  { id: "Respondido", title: "Respondido", dotClass: "bg-brand/70" },
  { id: "Qualificado", title: "Qualificado", dotClass: "bg-primary" },
  { id: "Não qualificado", title: "Não Qualificado", dotClass: "bg-muted-foreground" },
];

const COLUMN_IDS = new Set<string>(COLUMNS.map((c) => c.id));
const INITIAL_LIMIT = 30;

function isColumnId(id: UniqueIdentifier | null | undefined): id is CrmStage {
  return typeof id === "string" && COLUMN_IDS.has(id);
}

// Colunas vizinhas usadas pelos botões "Voltar" / "Avançar etapa" (card parado e overlay)
function getNeighborCols(colIndex: number): { prevCol: CrmStage | null; nextCol: CrmStage | null } {
  return {
    prevCol: colIndex > 0 && colIndex < 3 ? COLUMNS[colIndex - 1].id : null,
    nextCol: colIndex >= 0 && colIndex < 2 ? COLUMNS[colIndex + 1].id : null,
  };
}

// Sub-componente da Coluna Droppable memoizado para evitar re-renders em colunas não afetadas
const KanbanColumn = memo(function KanbanColumn({
  col,
  colIndex,
  colLeads,
  totalCount,
  limit,
  isOverThis,
  reducedMotion,
  recentMoves,
  onShowMore,
  onSelectLead,
  onRemoveFromCrm,
  onStatusChange,
}: {
  col: (typeof COLUMNS)[number];
  colIndex: number;
  colLeads: LeadItem[];
  totalCount: number;
  limit: number;
  isOverThis: boolean;
  reducedMotion: boolean;
  recentMoves: Record<string, "next" | "prev">;
  onShowMore: (colId: CrmStage) => void;
  onSelectLead: (lead: LeadItem) => void;
  onRemoveFromCrm: (id: string) => void;
  onStatusChange: (id: string, newStatus: CrmStage, direction?: "next" | "prev") => void;
}) {
  const { setNodeRef } = useDroppable({
    id: col.id,
    data: {
      type: "column",
      columnId: col.id,
    },
  });

  const visibleLeads = colLeads.slice(0, limit);
  const hasMore = colLeads.length > limit;

  const { prevCol, nextCol } = getNeighborCols(colIndex);

  return (
    <div
      ref={setNodeRef}
      aria-label={`Coluna ${col.title}`}
      className={cn(
        ui.card,
        "p-4 flex flex-col min-h-[540px] transition-[border-color,background-color,box-shadow] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]",
        isOverThis &&
          "border-primary/60 bg-primary-soft/25"
      )}
    >
      {/* Topo da Coluna */}
      <div className="flex items-center justify-between pb-3 border-b border-border mb-3 select-none">
        <div className="flex items-center gap-2">
          <span className={cn("w-2.5 h-2.5 rounded-full", col.dotClass)} />
          <h3 className="font-bold text-sm text-foreground">{col.title}</h3>
        </div>

        {/* Badge numérico com pop animado */}
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={totalCount}
            initial={reducedMotion ? false : { scale: 0.8, opacity: 0.6 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={reducedMotion ? undefined : { scale: 0.8, opacity: 0 }}
            transition={reducedMotion ? { duration: 0.01 } : springPhysics.snappy}
            className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-surface text-muted-foreground border border-border tabular-nums"
          >
            {formatNumberBR(totalCount)}
          </motion.span>
        </AnimatePresence>
      </div>

      {/* Lista de Cards com SortableContext e scroll independente */}
      <SortableContext
        items={visibleLeads.map((l) => l.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="flex flex-col gap-3 flex-1 overflow-y-auto overflow-x-hidden max-h-[650px] pr-1">
          {colLeads.length === 0 ? (
            <motion.div
              initial={reducedMotion ? false : { opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={reducedMotion ? { duration: 0.01 } : springPhysics.gentle}
              className={cn(
                "p-6 text-center text-xs text-muted-foreground border border-dashed rounded-xl my-auto transition-colors duration-200",
                isOverThis
                  ? "border-primary text-brand font-semibold bg-primary-soft/50"
                  : "border-border"
              )}
            >
              {isOverThis
                ? `Soltar aqui para mover para "${col.title}"`
                : "Arraste um lead para esta etapa."}
            </motion.div>
          ) : (
            <>
              {visibleLeads.map((lead) => (
                <KanbanCard
                  key={lead.id}
                  lead={lead}
                  columnId={col.id}
                  prevCol={prevCol}
                  nextCol={nextCol}
                  enterDirection={recentMoves[lead.id] ?? null}
                  onSelectLead={onSelectLead}
                  onRemoveFromCrm={onRemoveFromCrm}
                  onStatusChange={onStatusChange}
                />
              ))}

              {hasMore && (
                <motion.button
                  type="button"
                  whileTap={reducedMotion ? undefined : motionGestures.tap}
                  onClick={() => onShowMore(col.id)}
                  className={cn(
                    ui.btnSecondary,
                    "w-full h-10 text-xs font-semibold shrink-0 mt-1"
                  )}
                >
                  <ChevronDown size={14} />
                  Mostrar mais ({formatNumberBR(colLeads.length - limit)} restantes)
                </motion.button>
              )}
            </>
          )}
        </div>
      </SortableContext>
    </div>
  );
});

export function CrmTab({
  leads,
  availableLeads = [],
  searchCandidates,
  searchQuery = "",
  onAddToCrm,
  onStatusChange,
  onRemoveFromCrm,
  onSelectLead,
  errorMessage = "",
  toastMessage = null,
  onDismissToast,
}: CrmTabProps) {
  const reducedMotion = usePrefersReducedMotion();

  const [addOpen, setAddOpen] = useState(false);
  const [addQuery, setAddQuery] = useState("");
  const [addingId, setAddingId] = useState<string | null>(null);
  const [addError, setAddError] = useState("");
  const [candidateResult, setCandidateResult] = useState<{
    query: string; loader: typeof searchCandidates; items: LeadItem[]; error?: string;
  }>();
  const currentCandidates = candidateResult?.query === addQuery && candidateResult?.loader === searchCandidates
    ? candidateResult : undefined;
  const candidatesLoading = Boolean(searchCandidates && addOpen && !currentCandidates);
  const candidateError = currentCandidates?.error ?? "";

  useEffect(() => {
    if (!addOpen || !searchCandidates) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void searchCandidates(addQuery, controller.signal).then(items => {
        if (!controller.signal.aborted) setCandidateResult({ query: addQuery, loader: searchCandidates, items });
      }).catch((error: unknown) => {
        if (!controller.signal.aborted) setCandidateResult({ query: addQuery, loader: searchCandidates, items: [],
          error: error instanceof Error ? error.message : "Falha ao buscar contatos." });
      });
    }, 300);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [addOpen, addQuery, searchCandidates]);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [overColId, setOverColId] = useState<CrmStage | null>(null);
  const [dragItems, setDragItems] = useState<Record<CrmStage, string[]> | null>(null);
  const [columnOrders, setColumnOrders] = useState<Partial<Record<CrmStage, string[]>>>({});
  const [recentMoves, setRecentMoves] = useState<Record<string, "next" | "prev">>({});

  const dragItemsRef = useRef<Record<CrmStage, string[]> | null>(null);
  const dragOriginColRef = useRef<CrmStage | null>(null);
  const lastOverIdRef = useRef<UniqueIdentifier | null>(null);
  const recentlyMovedNewContainerRef = useRef(false);
  const moveTimersRef = useRef<Map<string, number>>(new Map());

  const [limits, setLimits] = useState<Record<CrmStage, number>>({
    "Em contato": INITIAL_LIMIT,
    Respondido: INITIAL_LIMIT,
    Qualificado: INITIAL_LIMIT,
    "Não qualificado": INITIAL_LIMIT,
  });

  const handleShowMore = useCallback((colId: CrmStage) => {
    setLimits((curr) => ({
      ...curr,
      [colId]: (curr[colId] || INITIAL_LIMIT) + INITIAL_LIMIT,
    }));
  }, []);

  useEffect(() => {
    const timers = moveTimersRef.current;
    return () => {
      for (const timer of timers.values()) {
        window.clearTimeout(timer);
      }
      timers.clear();
    };
  }, []);

  // Sensores com limiar de ativação (6px pointer / 180ms touch) evitando cliques acidentais
  const pointerSensor = useSensor(PointerSensor, {
    activationConstraint: {
      distance: 6,
    },
  });

  const touchSensor = useSensor(TouchSensor, {
    activationConstraint: {
      delay: 180,
      tolerance: 6,
    },
  });

  const keyboardSensor = useSensor(KeyboardSensor, {
    coordinateGetter: sortableKeyboardCoordinates,
  });

  const sensors = useSensors(pointerSensor, touchSensor, keyboardSensor);

  const candidates = useMemo(() => {
    const included = new Set(leads.map((lead) => lead.id));
    const query = addQuery.trim().toLocaleLowerCase("pt-BR");
    return (searchCandidates ? currentCandidates?.items ?? [] : availableLeads).filter(
      (lead) =>
        !included.has(lead.id) &&
        (searchCandidates || `${lead.nome} ${lead.cidade} ${lead.uf}`.toLocaleLowerCase("pt-BR").includes(query))
    );
  }, [availableLeads, leads, addQuery, searchCandidates, currentCandidates]);

  async function addLead(id: string) {
    if (!onAddToCrm || addingId) return;
    setAddingId(id);
    setAddError("");
    try {
      if (!(await onAddToCrm(id))) setAddError("Não foi possível adicionar o lead ao CRM.");
    } catch (error) {
      setAddError(error instanceof Error ? error.message : "Não foi possível adicionar o lead.");
    } finally {
      setAddingId(null);
    }
  }

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

  const leadsById = useMemo(() => {
    const map = new Map<string, LeadItem>();
    for (const lead of filteredLeads) {
      map.set(lead.id, lead);
    }
    return map;
  }, [filteredLeads]);

  // Agrupa leads por coluna respeitando ordem manual local e timestamp de atualização
  const groupedByCol = useMemo(() => {
    const groups: Record<CrmStage, LeadItem[]> = {
      "Em contato": [],
      Respondido: [],
      Qualificado: [],
      "Não qualificado": [],
    };
    for (const lead of filteredLeads) {
      if (lead.status !== "Não contatado") {
        const st = groups[lead.status] ? lead.status : "Em contato";
        groups[st].push(lead);
      }
    }
    for (const col of COLUMNS) {
      const savedOrder = columnOrders[col.id];
      if (savedOrder?.length) {
        const orderIndex = new Map(savedOrder.map((id, idx) => [id, idx]));
        groups[col.id].sort((a, b) => {
          const idxA = orderIndex.get(a.id);
          const idxB = orderIndex.get(b.id);
          if (idxA !== undefined && idxB !== undefined) return idxA - idxB;
          if (idxA !== undefined) return 1; // Novos leads entram no topo
          if (idxB !== undefined) return -1;
          return (b.updatedAt || 0) - (a.updatedAt || 0);
        });
      } else {
        groups[col.id].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
      }
    }
    return groups;
  }, [filteredLeads, columnOrders]);

  // Lista efetiva exibida em cada coluna (durante drag usa dragItems para preview imediato entre colunas)
  const displayedByCol = useMemo(() => {
    if (!dragItems) return groupedByCol;
    const next: Record<CrmStage, LeadItem[]> = {
      "Em contato": [],
      Respondido: [],
      Qualificado: [],
      "Não qualificado": [],
    };
    for (const col of COLUMNS) {
      for (const id of dragItems[col.id]) {
        const item = leadsById.get(id);
        if (item) next[col.id].push(item);
      }
    }
    return next;
  }, [dragItems, groupedByCol, leadsById]);

  const currentItemIdsByColRef = useRef<Record<CrmStage, string[]>>({
    "Em contato": [],
    Respondido: [],
    Qualificado: [],
    "Não qualificado": [],
  });

  useEffect(() => {
    currentItemIdsByColRef.current = {
      "Em contato": displayedByCol["Em contato"].map((l) => l.id),
      Respondido: displayedByCol["Respondido"].map((l) => l.id),
      Qualificado: displayedByCol["Qualificado"].map((l) => l.id),
      "Não qualificado": displayedByCol["Não qualificado"].map((l) => l.id),
    };
  }, [displayedByCol]);

  useEffect(() => {
    requestAnimationFrame(() => {
      recentlyMovedNewContainerRef.current = false;
    });
  }, [dragItems]);

  const qualificadosCount = groupedByCol["Qualificado"].length;
  const taxaQualificacao =
    filteredLeads.length > 0 && qualificadosCount > 0
      ? `${((qualificadosCount / filteredLeads.length) * 100).toFixed(1).replace(/\.0$/, "")}%`
      : "0%";

  const activeLead = useMemo(() => {
    if (!activeId) return null;
    return leadsById.get(activeId) || null;
  }, [activeId, leadsById]);

  // Movimento por botão ("Avançar etapa" / "Voltar") com animação direcional e optimistic update
  const handleButtonStatusChange = useCallback(
    (id: string, newStatus: CrmStage, direction?: "next" | "prev") => {
      if (direction) {
        setRecentMoves((prev) => ({ ...prev, [id]: direction }));
        const prevTimer = moveTimersRef.current.get(id);
        if (prevTimer) window.clearTimeout(prevTimer);
        const timer = window.setTimeout(() => {
          setRecentMoves((curr) => {
            const copy = { ...curr };
            delete copy[id];
            return copy;
          });
          moveTimersRef.current.delete(id);
        }, 320);
        moveTimersRef.current.set(id, timer);
      }
      // Garante que o lead entre no topo da coluna de destino
      setColumnOrders((prev) => {
        const next: Partial<Record<CrmStage, string[]>> = { ...prev };
        for (const col of COLUMNS) {
          if (next[col.id]) {
            next[col.id] = next[col.id]!.filter((itemId) => itemId !== id);
          }
        }
        return next;
      });
      void onStatusChange(id, newStatus);
    },
    [onStatusChange]
  );

  // Estratégia de detecção de colisão multi-coluna (estilo Trello/Linear)
  const collisionDetectionStrategy: CollisionDetection = useCallback((args) => {
    const pointerIntersections = pointerWithin(args);
    const intersections =
      pointerIntersections.length > 0 ? pointerIntersections : rectIntersection(args);

    let overId = getFirstCollision(intersections, "id");

    if (overId != null) {
      if (isColumnId(overId)) {
        const colItemIds =
          dragItemsRef.current?.[overId] ?? currentItemIdsByColRef.current[overId] ?? [];
        if (colItemIds.length > 0) {
          const closestInCol = closestCorners({
            ...args,
            droppableContainers: args.droppableContainers.filter(
              (container) =>
                container.id !== overId && colItemIds.includes(String(container.id))
            ),
          });
          if (closestInCol.length > 0) {
            overId = closestInCol[0].id;
          }
        }
      }
      lastOverIdRef.current = overId;
      return [{ id: overId }];
    }

    if (recentlyMovedNewContainerRef.current) {
      lastOverIdRef.current = args.active.id;
    }

    return lastOverIdRef.current != null
      ? [{ id: lastOverIdRef.current }]
      : closestCorners(args);
  }, []);

  const findContainer = useCallback(
    (id: UniqueIdentifier, itemsMap: Record<CrmStage, string[]>): CrmStage | null => {
      if (isColumnId(id)) return id;
      for (const col of COLUMNS) {
        if (itemsMap[col.id].includes(String(id))) return col.id;
      }
      return null;
    },
    []
  );

  const handleDragStart = useCallback(
    ({ active }: DragStartEvent) => {
      const id = String(active.id);
      const snapshot: Record<CrmStage, string[]> = {
        "Em contato": groupedByCol["Em contato"].map((l) => l.id),
        Respondido: groupedByCol["Respondido"].map((l) => l.id),
        Qualificado: groupedByCol["Qualificado"].map((l) => l.id),
        "Não qualificado": groupedByCol["Não qualificado"].map((l) => l.id),
      };
      const origin = findContainer(id, snapshot);
      dragOriginColRef.current = origin;
      lastOverIdRef.current = id;
      dragItemsRef.current = snapshot;
      setDragItems(snapshot);
      setActiveId(id);
      setOverColId(origin);
    },
    [groupedByCol, findContainer]
  );

  const handleDragOver = useCallback(
    ({ active, over }: DragOverEvent) => {
      if (!over) {
        setOverColId(null);
        return;
      }

      const prev = dragItemsRef.current;
      if (!prev) return;

      const activeItemId = String(active.id);
      const overItemId = String(over.id);

      const activeContainer = findContainer(activeItemId, prev);
      const overContainer = findContainer(overItemId, prev);

      setOverColId(overContainer);

      if (!activeContainer || !overContainer || activeContainer === overContainer) {
        return;
      }

      const activeList = prev[activeContainer];
      const overList = prev[overContainer];
      const overIndex = overList.indexOf(overItemId);
      const colLimit = limits[overContainer] || INITIAL_LIMIT;

      let newIndex: number;
      if (isColumnId(overItemId)) {
        newIndex = Math.min(overList.length, colLimit);
      } else {
        const isBelowOverItem =
          active.rect.current.translated != null &&
          active.rect.current.translated.top > over.rect.top + over.rect.height / 2;
        const modifier = isBelowOverItem ? 1 : 0;
        newIndex = overIndex >= 0 ? overIndex + modifier : Math.min(overList.length, colLimit);
      }

      recentlyMovedNewContainerRef.current = true;

      const next: Record<CrmStage, string[]> = {
        ...prev,
        [activeContainer]: activeList.filter((item) => item !== activeItemId),
        [overContainer]: [
          ...overList.slice(0, newIndex),
          activeItemId,
          ...overList.slice(newIndex),
        ],
      };

      dragItemsRef.current = next;
      setDragItems(next);
    },
    [findContainer, limits]
  );

  const handleDragEnd = useCallback(
    ({ active, over }: DragEndEvent) => {
      const id = String(active.id);
      const originCol = dragOriginColRef.current;
      const currentItems = dragItemsRef.current;

      if (!over || !currentItems) {
        dragItemsRef.current = null;
        dragOriginColRef.current = null;
        setActiveId(null);
        setOverColId(null);
        setDragItems(null);
        return;
      }

      const currentContainer = findContainer(id, currentItems);
      const overContainer = findContainer(over.id, currentItems);

      if (!currentContainer || !overContainer) {
        dragItemsRef.current = null;
        dragOriginColRef.current = null;
        setActiveId(null);
        setOverColId(null);
        setDragItems(null);
        return;
      }

      const activeIndex = currentItems[currentContainer].indexOf(id);
      const overIndex = currentItems[overContainer].indexOf(String(over.id));

      let updatedTargetIds = currentItems[overContainer];
      if (
        currentContainer === overContainer &&
        activeIndex !== -1 &&
        overIndex !== -1 &&
        activeIndex !== overIndex
      ) {
        updatedTargetIds = arrayMove(currentItems[overContainer], activeIndex, overIndex);
      }

      // Salva ordem visual local imediatamente para o card assentar no ponto exato do drop
      setColumnOrders((prev) => ({
        ...prev,
        ...(originCol && originCol !== overContainer
          ? { [originCol]: currentItems[originCol].filter((itemId) => itemId !== id) }
          : {}),
        [overContainer]: updatedTargetIds,
      }));

      dragItemsRef.current = null;
      dragOriginColRef.current = null;
      setActiveId(null);
      setOverColId(null);
      setDragItems(null);

      if (originCol && originCol !== overContainer) {
        void onStatusChange(id, overContainer);
      }
    },
    [findContainer, onStatusChange]
  );

  const handleDragCancel = useCallback(() => {
    dragItemsRef.current = null;
    dragOriginColRef.current = null;
    setActiveId(null);
    setOverColId(null);
    setDragItems(null);
  }, []);

  const dropAnimationConfig: DropAnimation | null = useMemo(
    () =>
      reducedMotion
        ? null
        : {
            duration: 210,
            easing: "cubic-bezier(0.22, 1, 0.36, 1)",
            sideEffects: defaultDropAnimationSideEffects({
              styles: {
                active: {
                  opacity: "0.45",
                },
              },
            }),
          },
    [reducedMotion]
  );

  const dndAnnouncements: Announcements = useMemo(
    () => ({
      onDragStart({ active }) {
        const lead = leadsById.get(String(active.id));
        return `Pegou o lead ${lead?.nome || "selecionado"}. Use as setas para mover entre colunas.`;
      },
      onDragOver({ active, over }) {
        if (!over) return;
        const lead = leadsById.get(String(active.id));
        const col = isColumnId(over.id)
          ? COLUMNS.find((c) => c.id === over.id)?.title
          : leadsById.get(String(over.id))?.status;
        if (col) return `${lead?.nome || "Lead"} sobre a coluna ${col}.`;
      },
      onDragEnd({ active, over }) {
        const lead = leadsById.get(String(active.id));
        if (!over) return `Movimentação de ${lead?.nome || "lead"} cancelada.`;
        const col = isColumnId(over.id)
          ? COLUMNS.find((c) => c.id === over.id)?.title
          : leadsById.get(String(over.id))?.status;
        return `${lead?.nome || "Lead"} movido para ${col || "a nova posição"}.`;
      },
      onDragCancel({ active }) {
        const lead = leadsById.get(String(active.id));
        return `Movimentação de ${lead?.nome || "lead"} cancelada.`;
      },
    }),
    [leadsById]
  );

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className={cn(ui.pageTitle, "flex items-center gap-2.5")}>
            <Calendar className="text-brand" size={24} />
            <span>CRM</span>
          </h2>
          <p className={ui.pageSubtitle}>
            Arraste os cards com fluidez entre as etapas do funil. O card acompanha o ponteiro e assenta suavemente na coluna de destino.
          </p>
        </div>

        {/* Indicadores do Funil */}
        <div className="flex flex-wrap items-center gap-3">
          <motion.button
            type="button"
            whileTap={reducedMotion ? undefined : motionGestures.tap}
            whileHover={reducedMotion ? undefined : motionGestures.hover}
            onClick={() => setAddOpen(true)}
            disabled={!onAddToCrm}
            className={cn(ui.btnBrand, "h-11 px-5")}
          >
            <Plus size={18} />
            Adicionar leads
          </motion.button>
          <div className={cn(ui.card, "px-4 py-2.5 flex items-center gap-2 text-xs")}>
            <TrendingUp size={16} className="text-brand" />
            <span className="text-muted-foreground">Taxa de Qualificação:</span>
            <span className="font-bold text-foreground tabular-nums">{taxaQualificacao}</span>
          </div>
        </div>
      </div>

      {errorMessage && (
        <div
          role="alert"
          className="rounded-xl border border-border bg-surface px-4 py-3 text-sm text-foreground"
        >
          {errorMessage}
        </div>
      )}

      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Adicionar leads ao CRM"
        description="Ao adicionar, o contato entra na etapa Em contato."
        size="lg"
      >
        <div className="space-y-4">
          <input
            type="search"
            aria-label="Pesquisar leads para o CRM"
            placeholder="Pesquisar nome, cidade ou UF"
            value={addQuery}
            onChange={(event) => setAddQuery(event.target.value)}
            className={ui.input}
          />
          {(addError || candidateError || errorMessage) && (
            <p role="alert" className="text-sm">
              {addError || candidateError || errorMessage}
            </p>
          )}
          <ul className="space-y-2">
            {candidates.slice(0, 30).map((lead) => (
              <li
                key={lead.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-border p-3"
              >
                <div className="min-w-0">
                  <p className="font-semibold truncate">{lead.nome}</p>
                  <p className="text-sm text-muted-foreground">
                    {lead.cidade} / {lead.uf}
                  </p>
                </div>
                <motion.button
                  type="button"
                  whileTap={reducedMotion ? undefined : motionGestures.tap}
                  aria-label={`Adicionar ${lead.nome} ao CRM`}
                  disabled={Boolean(addingId)}
                  onClick={() => void addLead(lead.id)}
                  className={cn(ui.btnSecondary, "h-10 px-3 shrink-0")}
                >
                  {addingId === lead.id ? "Salvando..." : "Adicionar"}
                </motion.button>
              </li>
            ))}
          </ul>
          {candidatesLoading && <p role="status">Buscando contatos…</p>}
          {!candidatesLoading && !addError && !candidateError && !candidates.length && (
            <p className="text-sm text-muted-foreground">Nenhum lead disponível para adicionar.</p>
          )}
          {candidates.length > 30 && (
            <p className="text-sm text-muted-foreground">
              Exibindo os primeiros 30 contatos. Refine a pesquisa para encontrar um lead.
            </p>
          )}
        </div>
      </Modal>

      {/* Kanban Board com DndContext */}
      <DndContext
        sensors={sensors}
        collisionDetection={collisionDetectionStrategy}
        accessibility={{ announcements: dndAnnouncements }}
        autoScroll={{
          enabled: true,
          threshold: { x: 0.15, y: 0.15 },
          acceleration: 14,
          interval: 5,
        }}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5 items-start">
          {COLUMNS.map((col, colIndex) => {
            const colLeads = displayedByCol[col.id];
            const totalCount = groupedByCol[col.id].length;
            // Destaque apenas na coluna de DESTINO (não na coluna de origem do card)
            const isOverThis =
              overColId === col.id && activeLead !== null && activeLead.status !== col.id;

            return (
              <KanbanColumn
                key={col.id}
                col={col}
                colIndex={colIndex}
                colLeads={colLeads}
                totalCount={totalCount}
                limit={limits[col.id] || INITIAL_LIMIT}
                isOverThis={isOverThis}
                reducedMotion={reducedMotion}
                recentMoves={recentMoves}
                onShowMore={handleShowMore}
                onSelectLead={onSelectLead}
                onRemoveFromCrm={onRemoveFromCrm}
                onStatusChange={handleButtonStatusChange}
              />
            );
          })}
        </div>

        {/* DragOverlay: renderiza o MESMO card (mesmas props) — tamanho medido pelo dnd-kit no início do arraste */}
        <DragOverlay dropAnimation={dropAnimationConfig}>
          {activeLead ? (() => {
            const activeColId: CrmStage =
              activeLead.status !== "Não contatado" ? activeLead.status : "Em contato";
            const { prevCol, nextCol } = getNeighborCols(
              COLUMNS.findIndex((c) => c.id === activeColId)
            );
            return (
              <KanbanCard
                lead={activeLead}
                columnId={activeColId}
                prevCol={prevCol}
                nextCol={nextCol}
                onRemoveFromCrm={onRemoveFromCrm}
                isOverlay
              />
            );
          })() : null}
        </DragOverlay>
      </DndContext>

      {onDismissToast && (
        <Toast toast={toastMessage} onDismiss={onDismissToast} />
      )}
    </div>
  );
}
