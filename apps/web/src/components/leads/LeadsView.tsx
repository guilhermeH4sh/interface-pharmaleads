import { useState, useEffect, useCallback, useMemo } from "react";
import { Plus, AlertCircle, Lock, Download } from "lucide-react";
import { MetricsCards } from "./MetricsCards";
import { LeadsTable } from "./LeadsTable";
import { FiltersSidebar, type SideFilters } from "./FiltersSidebar";
import { BatchActionsBar } from "./BatchActionsBar";
import { LeadDetailsModal } from "./LeadDetailsModal";
import { LeadSearch } from "./LeadSearch";
import { Select, type SelectOption } from "../ui/select";
import { downloadLeadPagesCsv, downloadLeadsCsv } from "../../lib/csv";
import { ui } from "../../lib/ui";
import { cn } from "../../lib/utils";
import type { EmailAvailability } from "../../lib/email";
import { ESTABLISHMENTS, SOURCES } from "../../lib/prospect-options";
import { getPreferences } from "../../lib/preferences";
import {
  computeSummaryFromItems,
  filterLeadItems,
  paginateLeadItems,
  markLeadDeletedLocal,
  AccessError,
  readRemoteLeads,
  walkRemoteLeads,
  fetchRemoteLeadMetrics,
  type DataSourceMode,
  type LeadMetrics,
  type SupabaseSession,
} from "../../lib/backend";
import {
  fetchMockLeads,
  fetchMockSummary,
  batchUpdateStatus,
  deleteLead,
  type LeadItem,
  type LeadSummary,
  MOCK_SUMMARY,
} from "../../lib/mock-leads";

interface LeadsViewProps {
  searchQuery: string;
  dataSourceMode?: DataSourceMode;
  realLeads?: LeadItem[];
  allLeadsSummary?: LeadSummary;
  isLoadingReal?: boolean;
  realError?: string;
  isSupabaseAuthenticated?: boolean;
  supabaseSession?: SupabaseSession | null;
  remoteVersion?: number;
  onSessionUpdate?: (session: SupabaseSession) => void;
  onSessionInvalid?: () => void;
  onMutateRealLeads?: () => void;
  onOpenConfig?: () => void;
  onCrmMembershipChange?: (leadId: string, included: boolean) => boolean | Promise<boolean> | void;
  onBatchAddToCrm: (leadIds: string[]) => Promise<string[]>;
}

const PREVIEW_LEAD_LIMIT = 50;

const EXPORT_PERIOD_OPTIONS: SelectOption[] = [
  { value: "7", label: "Últimos 7 dias" },
  { value: "15", label: "Últimos 15 dias" },
  { value: "30", label: "Últimos 30 dias" },
  { value: "month", label: "Este mês" },
  { value: "all", label: "Todo o período" },
];

export function LeadsView({
  searchQuery,
  dataSourceMode = "mock",
  realLeads = [],
  allLeadsSummary,
  isLoadingReal = false,
  realError = "",
  isSupabaseAuthenticated = false,
  supabaseSession,
  remoteVersion,
  onSessionUpdate,
  onSessionInvalid,
  onMutateRealLeads,
  onOpenConfig,
  onCrmMembershipChange,
  onBatchAddToCrm,
}: LeadsViewProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [searched, setSearched] = useState(false);
  const [collectionUpdate, setCollectionUpdate] = useState<{ filters: typeof filters; startedAt: string }>();
  const [livePage, setLivePage] = useState<{ filters: typeof filters; items: LeadItem[] }>();
  const [queryRetry, setQueryRetry] = useState(0);
  const [exportPeriod, setExportPeriod] = useState("7");
  const getUrlParam = (param: string, fallback = "") => {
    if (typeof window === "undefined") return fallback;
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(param) || fallback;
  };

  const [currentPage, setCurrentPage] = useState<number>(
    dataSourceMode === "supabase" ? 1 : parseInt(getUrlParam("page", "1"), 10) || 1
  );
  const [pageSize, setPageSize] = useState(() => getPreferences().pageSize);
  useEffect(() => {
    const update = () => { setPageSize(getPreferences().pageSize); setCurrentPage(1); };
    window.addEventListener("pharmaleads-preferences-change", update);
    return () => window.removeEventListener("pharmaleads-preferences-change", update);
  }, []);
  const [selectedUF, setSelectedUF] = useState(getUrlParam("uf", ""));
  const [selectedOrigem, setSelectedOrigem] = useState(getUrlParam("origem", "Todas as origens"));
  const [selectedSegmentos, setSelectedSegmentos] = useState<string[]>(() => {
    const validos = new Set(ESTABLISHMENTS.map(item => item.value));
    return [...new Set(getUrlParam("segmentos").split(",").filter(item => validos.has(item)))];
  });
  const [selectedEmailAvailability, setSelectedEmailAvailability] = useState<EmailAvailability>(() => {
    const value = getUrlParam("email", "todos");
    return value === "com" || value === "sem" ? value : "todos";
  });

  // Estados do modo Mock
  const [mockLeads, setMockLeads] = useState<LeadItem[]>([]);
  const [mockTotalLeads, setMockTotalLeads] = useState<number>(MOCK_SUMMARY.totalLeads);
  const [mockTotalPages, setMockTotalPages] = useState<number>(1);
  const [mockSummary, setMockSummary] = useState<LeadSummary>(MOCK_SUMMARY);
  const [isLoadingMock, setIsLoadingMock] = useState<boolean>(true);

  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  const [selectedWholeResults, setSelectedWholeResults] = useState(false);
  const [detailLead, setDetailLead] = useState<LeadItem | null>(null);

  const isRealMode = dataSourceMode === "local" || dataSourceMode === "supabase";
  const isRemote = dataSourceMode === "supabase" && Boolean(supabaseSession);
  const filters = useMemo(() => ({
    uf: selectedUF, origem: selectedOrigem, segmentos: selectedSegmentos,
    emailAvailability: selectedEmailAvailability, query: searchQuery, includeCrm: searched,
  }), [selectedUF, selectedOrigem, selectedSegmentos, selectedEmailAvailability, searchQuery, searched]);
  const [cursors, setCursors] = useState<Array<string | undefined>>([undefined]);
  const cursor = cursors[currentPage - 1];
  const request = useMemo(() => ({ filters, cursor, currentPage, pageSize, remoteVersion, searched, queryRetry }),
    [filters, cursor, currentPage, pageSize, remoteVersion, searched, queryRetry]);
  const [remotePage, setRemotePage] = useState<{
    request: typeof request; items: LeadItem[]; next?: string; error?: string;
  }>();
  const [operation, setOperation] = useState("");
  const [operationError, setOperationError] = useState("");
  const [remoteMetrics, setRemoteMetrics] = useState<LeadMetrics>();
  const [metricsError, setMetricsError] = useState("");

  useEffect(() => {
    if (!isRemote || !supabaseSession) return;
    const controller = new AbortController();
    const remaining = request.searched ? Infinity : PREVIEW_LEAD_LIMIT - (request.currentPage - 1) * request.pageSize;
    const limit = Math.min(request.pageSize, remaining);
    void readRemoteLeads(supabaseSession, request.filters, {
      limit, cursor: request.cursor, peek: remaining > limit, signal: controller.signal,
    }).then(page => {
      if (controller.signal.aborted) return;
      setRemotePage({ request, items: page.items, next: page.hasNext ? page.cursor : undefined });
      if (page.session !== supabaseSession) onSessionUpdate?.(page.session);
    }).catch((error: unknown) => {
      if (controller.signal.aborted) return;
      if (error instanceof AccessError) onSessionInvalid?.();
      setRemotePage(previous => ({ request, items: previous?.request === request ? previous.items : [],
        error: error instanceof Error ? error.message : "Falha na consulta." }));
    });
    return () => controller.abort();
  }, [isRemote, supabaseSession, request, collectionUpdate, onSessionUpdate, onSessionInvalid]);

  useEffect(() => {
    if (!isRemote || !supabaseSession) return;
    const controller = new AbortController();
    void fetchRemoteLeadMetrics(supabaseSession, controller.signal).then(metrics => {
      if (controller.signal.aborted) return;
      setRemoteMetrics(metrics);
      setMetricsError("");
    }).catch((error: unknown) => {
      if (controller.signal.aborted) return;
      if (error instanceof AccessError) onSessionInvalid?.();
      setMetricsError("Não foi possível consultar as métricas da carteira.");
    });
    return () => controller.abort();
  }, [isRemote, supabaseSession, remoteVersion, queryRetry, collectionUpdate, onSessionInvalid]);

  useEffect(() => {
    if (!supabaseSession || !collectionUpdate || collectionUpdate.filters !== filters) return;
    const controller = new AbortController();
    void readRemoteLeads(supabaseSession, filters, {
      limit: 25, createdSince: collectionUpdate.startedAt, signal: controller.signal,
    }).then(page => {
      if (!controller.signal.aborted) setLivePage({ filters, items: page.items });
    }).catch(() => {
      // A consulta principal continua disponível durante a atualização.
    });
    return () => controller.abort();
  }, [supabaseSession, filters, collectionUpdate, remoteVersion]);

  const refreshAfterCollection = useCallback((uf: string, startedAt: string) => {
    if (filters.uf === uf) setCollectionUpdate({ filters, startedAt });
  }, [filters]);

  const updateUrl = useCallback(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams();
    if (searchQuery.trim()) params.set("q", searchQuery.trim());
    if (currentPage > 1 && !isRemote) params.set("page", String(currentPage));
    if (selectedUF) params.set("uf", selectedUF);
    if (selectedOrigem && selectedOrigem !== "Todas as origens") params.set("origem", selectedOrigem);
    if (selectedSegmentos.length) params.set("segmentos", selectedSegmentos.join(","));
    if (selectedEmailAvailability !== "todos") params.set("email", selectedEmailAvailability);

    const newUrl = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ""}`;
    window.history.replaceState({}, "", newUrl);
  }, [
    searchQuery,
    currentPage,
    selectedUF,
    selectedOrigem,
    selectedSegmentos,
    selectedEmailAvailability,
    isRemote,
  ]);

  const loadMockLeads = useCallback(async () => {
    if (isRealMode) return;
    setIsLoadingMock(true);
    try {
      const res = await fetchMockLeads({
        query: searchQuery,
        statusTab: "Todos",
        uf: selectedUF,
        statusSelect: "Todos os status",
        origem: selectedOrigem,
        segmentos: selectedSegmentos,
        emailAvailability: selectedEmailAvailability,
        page: currentPage,
        pageSize,
      });

      setMockLeads(res.items);
      const hasSpecificFilter =
        Boolean(searchQuery) ||
        Boolean(selectedUF) ||
        selectedOrigem !== "Todas as origens" ||
        selectedSegmentos.length > 0 ||
        selectedEmailAvailability !== "todos";

      setMockTotalLeads(hasSpecificFilter ? res.total : MOCK_SUMMARY.totalLeads);
      setMockTotalPages(hasSpecificFilter ? res.totalPages : Math.ceil(MOCK_SUMMARY.totalLeads / pageSize));
    } catch (err) {
      console.error("Falha ao consultar leads:", err);
    } finally {
      setIsLoadingMock(false);
    }
  }, [
    isRealMode,
    searchQuery,
    selectedUF,
    selectedOrigem,
    selectedSegmentos,
    selectedEmailAvailability,
    currentPage,
    pageSize,
  ]);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void loadMockLeads();
    });
    updateUrl();
    return () => {
      cancelled = true;
    };
  }, [loadMockLeads, updateUrl]);

  useEffect(() => {
    if (!isRealMode) {
      fetchMockSummary().then(setMockSummary).catch(console.error);
    }
  }, [isRealMode]);

  const hasLeadFilters = Boolean(searchQuery.trim() || selectedUF || selectedSegmentos.length)
    || selectedOrigem !== "Todas as origens" || selectedEmailAvailability !== "todos";
  const filteredRealLeads = useMemo(
    () => isRealMode && hasLeadFilters ? filterLeadItems(realLeads, {
      query: searchQuery,
      uf: selectedUF,
      origem: selectedOrigem,
      segmentos: selectedSegmentos,
      emailAvailability: selectedEmailAvailability,
    }) : realLeads,
    [isRealMode, hasLeadFilters, realLeads, searchQuery, selectedUF, selectedOrigem, selectedSegmentos, selectedEmailAvailability]
  );
  const realSummary = useMemo(
    () => hasLeadFilters ? computeSummaryFromItems(filteredRealLeads) : allLeadsSummary ?? computeSummaryFromItems(realLeads),
    [hasLeadFilters, filteredRealLeads, allLeadsSummary, realLeads]
  );
  const realPagination = useMemo(
    () => isRealMode ? paginateLeadItems(filteredRealLeads, { page: currentPage, pageSize }) : null,
    [isRealMode, filteredRealLeads, currentPage, pageSize]
  );
  const availableUFs = useMemo(
    () => isRealMode && !isRemote ? [...new Set(realLeads.map(lead => lead.uf).filter(Boolean))].sort() : undefined,
    [isRealMode, isRemote, realLeads]
  );
  const availableOrigins = useMemo(
    () => isRemote ? SOURCES.map(source => source.value)
      : isRealMode ? [...new Set(realLeads.map(lead => lead.origem))].sort() : undefined,
    [isRealMode, isRemote, realLeads]
  );

  const page = remotePage?.request === request ? remotePage : undefined;
  const localItems = realPagination?.items ?? mockLeads;
  const liveItems = searched && livePage?.filters === filters ? livePage.items : [];
  const pageItems = page?.items ?? [];
  const liveIds = new Set(liveItems.map(item => item.id));
  const remoteItems = currentPage === 1
    ? [...pageItems, ...liveItems.filter(item => !pageItems.some(row => row.id === item.id))]
    : pageItems.filter(item => !liveIds.has(item.id));
  const activeItems = isRemote ? remoteItems : searched ? localItems
    : localItems.slice(0, Math.max(0, PREVIEW_LEAD_LIMIT - (currentPage - 1) * pageSize));
  const activeTotal = isRemote ? activeItems.length : realPagination?.total ?? mockTotalLeads;
  const unboundedPages = realPagination?.totalPages ?? mockTotalPages;
  const activeTotalPages = searched ? unboundedPages : Math.min(unboundedPages, Math.ceil(PREVIEW_LEAD_LIMIT / pageSize));
  const activeSummary = isRealMode ? realSummary : mockSummary;
  const activeLoading = isRemote ? !page : isRealMode ? isLoadingReal : isLoadingMock;
  const activeError = operationError || page?.error || realError;
  const clearSelection = () => { setSelectedLeadIds([]); setSelectedWholeResults(false); };

  const runOperation = async (label: string, action: () => Promise<void>) => {
    if (operation) return;
    setOperation(label);
    setOperationError("");
    try { await action(); }
    catch (error) {
      if (error instanceof AccessError) onSessionInvalid?.();
      setOperationError(error instanceof Error ? error.message : "Não foi possível concluir a operação.");
    } finally { setOperation(""); }
  };

  const handleApplySideFilters = (filters: SideFilters) => {
    setLivePage(undefined);
    setCollectionUpdate(undefined);
    setSelectedUF(filters.uf);
    setSelectedOrigem(filters.origem);
    setSelectedSegmentos(filters.segmentos);
    setSelectedEmailAvailability(filters.emailAvailability);
    setCurrentPage(1);
    clearSelection();
  };

  const handleResetFilters = () => {
    setLivePage(undefined);
    setCollectionUpdate(undefined);
    setSelectedUF("");
    setSelectedOrigem("Todas as origens");
    setSelectedSegmentos([]);
    setSelectedEmailAvailability("todos");
    setCurrentPage(1);
    setSearched(false);
    clearSelection();
  };

  const handleSearch = (search: { uf: string; origem: string; segmentos: string[] }) => {
    setSearched(true);
    handleApplySideFilters({ ...search, statusSelect: "Todos os status", emailAvailability: selectedEmailAvailability });
  };

  const handleBatchAddToCrm = async () => {
    if (isRealMode) {
      await runOperation("Adicionando ao CRM…", async () => {
        const moved = new Set(await onBatchAddToCrm(selectedLeadIds));
        setSelectedLeadIds((current) => current.filter((id) => !moved.has(id)));
        if (detailLead && moved.has(detailLead.id)) setDetailLead(null);
      });
      return;
    } else {
      await batchUpdateStatus(selectedLeadIds, "Em contato");
      void loadMockLeads();
    }
    setSelectedLeadIds([]);
  };

  const handleDeleteLead = async (id: string) => {
    if (isRealMode) {
      markLeadDeletedLocal(id);
      onMutateRealLeads?.();
    } else {
      await deleteLead(id);
      void loadMockLeads();
    }
    setSelectedLeadIds((current) => current.filter((x) => x !== id));
  };

  const handleExportCSV = (exportItems?: LeadItem[]) => {
    const dataToExport = exportItems && exportItems.length ? exportItems : activeItems;
    downloadLeadsCsv(dataToExport, "pharmaleads_export");
  };

  const exportCutoff = () => {
    if (exportPeriod === "all") return undefined;
    const now = new Date();
    return exportPeriod === "month"
      ? new Date(now.getFullYear(), now.getMonth(), 1).getTime()
      : now.getTime() - Number(exportPeriod) * 24 * 60 * 60 * 1000;
  };

  const getLeadsForExportPeriod = () => {
    const cutoff = exportCutoff();
    if (cutoff === undefined) return filteredRealLeads;
    return filteredRealLeads.filter((lead) => {
      const collected = lead.ultimaColeta ? Date.parse(lead.ultimaColeta) : NaN;
      return Number.isFinite(collected) && collected >= cutoff;
    });
  };

  const handleExportByPeriod = async () => {
    const suffix = exportPeriod === "all" ? "todo_periodo"
      : exportPeriod === "month" ? "mes_atual" : `ultimos_${exportPeriod}_dias`;
    if (isRemote && supabaseSession) {
      await runOperation("Preparando exportação…", async () => {
        const cutoff = exportCutoff();
        const batches = walkRemoteLeads(supabaseSession, filters, {
          since: cutoff === undefined ? undefined : new Date(cutoff).toISOString(),
        });
        async function* pages() { for await (const batch of batches) yield batch.items; }
        if (!await downloadLeadPagesCsv(pages(), `pharmaleads_${suffix}`)) {
          throw new Error("Nenhum lead encontrado no período selecionado.");
        }
      });
    } else {
      const records = getLeadsForExportPeriod();
      if (records.length) downloadLeadsCsv(records, `pharmaleads_${suffix}`);
    }
  };

  const selectAllResults = () => runOperation("Selecionando todos os resultados…", async () => {
    if (!supabaseSession) return;
    const ids = new Set<string>();
    for await (const batch of walkRemoteLeads(supabaseSession, filters, { idsOnly: true })) {
      for (const id of batch.ids) ids.add(id);
    }
    setSelectedLeadIds([...ids]);
    setSelectedWholeResults(true);
  });

  const exportSelection = () => {
    const selected = new Set(selectedLeadIds);
    if (!isRemote || !supabaseSession) {
      handleExportCSV((isRealMode ? filteredRealLeads : activeItems).filter(item => selected.has(item.id)));
      return;
    }
    const active = supabaseSession;
    async function* selectedPages() {
      if (selectedWholeResults) {
        for await (const batch of walkRemoteLeads(active, filters, {})) {
          yield batch.items.filter(item => selected.has(item.id));
        }
      } else {
        let session = active;
        for (let index = 0; index < selectedLeadIds.length; index += 75) {
          const batch = await readRemoteLeads(session, filters, { limit: 75, ids: selectedLeadIds.slice(index, index + 75) });
          session = batch.session;
          yield batch.items;
        }
      }
    }
    void runOperation("Preparando exportação da seleção…", async () => {
      if (!await downloadLeadPagesCsv(selectedPages(), "pharmaleads_export")) {
        throw new Error("Nenhum dos leads selecionados continua disponível.");
      }
    });
  };

  const handleToggleSelect = (id: string) => {
    setSelectedLeadIds((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id]
    );
  };

  const handleToggleSelectAll = () => {
    const pageIds = activeItems.map((item) => item.id);
    const allInPageSelected = pageIds.every((id) => selectedLeadIds.includes(id));
    if (allInPageSelected) {
      setSelectedLeadIds((current) => current.filter((id) => !pageIds.includes(id)));
    } else {
      setSelectedLeadIds((current) => [...new Set([...current, ...pageIds])]);
    }
  };

  return (
    <div className="space-y-6">
      {/* 3. Cabeçalho da página: h1, subtítulo e botão "+ Nova Prospecção" */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className={ui.pageTitle}>Leads – Farmácias</h1>
          <p className={ui.pageSubtitle}>
            Gerencie, filtre e acompanhe os leads de farmácias em todo o Brasil.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Select
            ariaLabel="Período para exportação"
            value={exportPeriod}
            onChange={setExportPeriod}
            options={EXPORT_PERIOD_OPTIONS}
            align="right"
            triggerClassName="h-12 w-44 rounded-xl text-sm"
          />
          <button type="button" onClick={() => void handleExportByPeriod()} disabled={Boolean(operation) || (isRemote ? activeLoading || Boolean(page?.error) : !getLeadsForExportPeriod().length)} className={cn(ui.btnSecondary, "h-12 px-4 text-sm shrink-0")}>
            <Download size={17} /><span>Exportar</span>
          </button>
          <button onClick={() => setSearchOpen(true)} disabled={Boolean(operation)} className={cn(ui.btnBrand, "h-12 px-6 sm:px-8 text-sm sm:text-base shrink-0")}>
            <Plus size={18} strokeWidth={2.5} /><span>Nova Prospecção</span>
          </button>
        </div>
      </div>

      {/* Aviso quando Supabase está selecionado mas ainda não autenticado */}
      {dataSourceMode === "supabase" && !isSupabaseAuthenticated && (
        <div className="p-4 rounded-2xl bg-primary-soft border border-primary/25 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <Lock size={18} className="text-brand mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-bold text-foreground">
                Autenticação necessária para public.pharmaleads (Supabase)
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Entre com sua conta autorizada do Supabase em Configurações ou alterne para o banco SQLite Local.
              </p>
            </div>
          </div>
          {onOpenConfig && (
            <button
              type="button"
              onClick={onOpenConfig}
              className={cn(ui.btnPrimary, "h-10 px-4 text-xs shrink-0")}
            >
              Entrar no Supabase
            </button>
          )}
        </div>
      )}

      {/* Aviso de erro de conexão */}
      {isRealMode && activeError && (
        <div
          role="alert"
          className="p-4 rounded-2xl bg-surface border border-border flex items-center justify-between gap-3 text-xs text-foreground"
        >
          <span className="flex items-center gap-2 font-medium">
            <AlertCircle size={16} className="text-brand shrink-0" />
            {activeError}
          </span>
          {onOpenConfig && (
            <button
              type="button"
              onClick={onOpenConfig}
              className="text-brand font-bold hover:underline shrink-0"
            >
              Verificar Configurações
            </button>
          )}
          {page?.error && <button type="button" onClick={() => setQueryRetry(value => value + 1)}>Tentar consulta novamente</button>}
        </div>
      )}

      {/* 4. Quatro cards de métricas em linha */}
      <MetricsCards summary={isRemote ? remoteMetrics ?? {} : activeSummary}
        isLoading={isRemote ? !remoteMetrics && !metricsError : activeLoading && !activeItems.length} />
      {metricsError && <p className="text-sm text-muted-foreground">{metricsError}{" "}
        <button type="button" className="underline" onClick={() => setQueryRetry(value => value + 1)}>Atualizar métricas</button>
      </p>}
      <LeadSearch session={supabaseSession} filters={{ uf: selectedUF, origem: selectedOrigem, segmentos: selectedSegmentos }}
        modalOpen={searchOpen} closeModal={() => setSearchOpen(false)} onSearch={handleSearch}
        onResultsChange={refreshAfterCollection} onSessionUpdate={onSessionUpdate} onSessionInvalid={onSessionInvalid}
        disabled={Boolean(operation)} />
      {!searched && <p className="text-sm text-muted-foreground">Amostra de até {PREVIEW_LEAD_LIMIT} leads. Pesquise um estado para ver todos os resultados desse recorte.</p>}
      {searched && isRemote && !activeLoading && !page?.error && !activeItems.length && (
        <p role="status" className="text-sm text-muted-foreground">Nenhum lead salvo para esses filtros. Se houver uma coleta em andamento, a lista será atualizada quando ela enviar resultados.</p>
      )}
      {operation && <p role="status">{operation}</p>}
      <p className="text-xs text-muted-foreground">A exportação inclui todos os leads que correspondem ao estado, aos filtros e ao período escolhidos.</p>

      {/* Filtros e tabela ocupam a largura principal sem a coluna lateral. */}
      <div className={cn(ui.cardInteractive, "w-full flex flex-col")}>
        <fieldset disabled={Boolean(operation)} className="min-w-0 p-4 md:p-6 border-b border-border">
          <FiltersSidebar
            key={`${selectedUF}|${selectedOrigem}|${selectedSegmentos.join(",")}|${selectedEmailAvailability}`}
            selectedUF={selectedUF}
            selectedStatus="Todos os status"
            selectedOrigem={selectedOrigem}
            selectedSegmentos={selectedSegmentos}
            selectedEmailAvailability={selectedEmailAvailability}
            onApplyFilters={handleApplySideFilters}
            onResetFilters={handleResetFilters}
            availableUFs={availableUFs}
            availableOrigins={availableOrigins}
            showStatusFilter={false}
          />
          {isRemote && (activeTotal > 0 || page?.next) && (
            <button type="button" className={cn(ui.btnSecondary, "mt-4")} onClick={() => void selectAllResults()}>
              Selecionar todos os resultados
            </button>
          )}
        </fieldset>

        <LeadsTable
            items={activeItems}
            total={activeTotal}
            currentPage={currentPage}
            totalPages={activeTotalPages}
            pageSize={pageSize}
            cursorNavigation={isRemote ? { hasNext: Boolean(page?.next) } : undefined}
            isLoading={activeLoading}
            onPageChange={(target) => {
              if (isRemote && target > currentPage) {
                if (!page?.next) return;
                setCursors(cursors => [...cursors.slice(0, currentPage), page.next]);
              }
              setCurrentPage(target);
            }}
            onViewDetails={(lead) => setDetailLead(lead)}
            onDeleteLead={handleDeleteLead}
            onCrmMembershipChange={(leadId, included) => onCrmMembershipChange?.(leadId, included)}
            selectedIds={selectedLeadIds}
            onToggleSelect={handleToggleSelect}
            onToggleSelectAll={handleToggleSelectAll}
          />
      </div>

      {/* Barra Flutuante de Ações em Lote */}
      <BatchActionsBar
        selectedCount={selectedLeadIds.length}
        onClearSelection={clearSelection}
        onBatchAddToCrm={handleBatchAddToCrm}
        onBatchExportCSV={exportSelection}
      />

      {/* Modal de Detalhes do Lead */}
      <LeadDetailsModal
        lead={detailLead}
        onClose={() => setDetailLead(null)}
        showStatusControls={false}
        onAddToCrm={detailLead?.crmIncluded ? undefined : async (leadId) => {
          const added = await onCrmMembershipChange?.(leadId, true);
          if (added !== false) setDetailLead(null);
        }}
      />


    </div>
  );
}
