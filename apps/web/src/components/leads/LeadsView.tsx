import { useState, useEffect, useCallback, useMemo } from "react";
import { Plus, AlertCircle, Lock } from "lucide-react";
import { MetricsCards } from "./MetricsCards";
import { LeadsTable } from "./LeadsTable";
import { FiltersSidebar } from "./FiltersSidebar";
import { BatchActionsBar } from "./BatchActionsBar";
import { LeadDetailsModal } from "./LeadDetailsModal";
import { downloadLeadsCsv } from "../../lib/csv";
import { ui } from "../../lib/ui";
import { cn } from "../../lib/utils";
import type { EmailAvailability } from "../../lib/email";
import {
  buildDynamicLocations,
  computeSummaryFromItems,
  filterAndPaginateItems,
  markLeadDeletedLocal,
  setBatchLeadResponsibleOverride,
  type DataSourceMode,
} from "../../lib/backend";
import {
  fetchMockLeads,
  fetchMockSummary,
  updateLeadStatus,
  batchUpdateStatus,
  deleteLead,
  type LeadItem,
  type LeadStatus,
  type LeadSummary,
  MOCK_SUMMARY,
} from "../../lib/mock-leads";

interface LeadsViewProps {
  searchQuery: string;
  dataSourceMode?: DataSourceMode;
  realLeads?: LeadItem[];
  isLoadingReal?: boolean;
  realError?: string;
  isSupabaseAuthenticated?: boolean;
  onMutateRealLeads?: () => void;
  onOpenConfig?: () => void;
  onCrmMembershipChange?: (leadId: string, included: boolean) => void;
  onStatusChange: (leadId: string, status: LeadStatus) => Promise<boolean>;
  onBatchStatusChange: (leadIds: string[], status: LeadStatus) => Promise<string[]>;
  onNewProspect?: () => void;
}

export function LeadsView({
  searchQuery,
  dataSourceMode = "mock",
  realLeads = [],
  isLoadingReal = false,
  realError = "",
  isSupabaseAuthenticated = false,
  onMutateRealLeads,
  onOpenConfig,
  onCrmMembershipChange,
  onStatusChange,
  onBatchStatusChange,
  onNewProspect,
}: LeadsViewProps) {
  const getUrlParam = (param: string, fallback = "") => {
    if (typeof window === "undefined") return fallback;
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(param) || fallback;
  };

  const legacyStatusTab = getUrlParam("tab", "Todos");
  const [currentPage, setCurrentPage] = useState<number>(
    parseInt(getUrlParam("page", "1"), 10) || 1
  );
  const [selectedUF, setSelectedUF] = useState(getUrlParam("uf", ""));
  const [selectedMunicipio, setSelectedMunicipio] = useState(getUrlParam("municipio", ""));
  const [selectedBairro, setSelectedBairro] = useState(getUrlParam("bairro", ""));
  const [selectedStatus, setSelectedStatus] = useState(
    getUrlParam("status", legacyStatusTab === "Todos" ? "Todos os status" : legacyStatusTab)
  );
  const [selectedOrigem, setSelectedOrigem] = useState(getUrlParam("origem", "Todas as origens"));
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
  const [detailLead, setDetailLead] = useState<LeadItem | null>(null);

  const isRealMode = dataSourceMode === "local" || dataSourceMode === "supabase";

  const updateUrl = useCallback(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams();
    if (searchQuery.trim()) params.set("q", searchQuery.trim());
    if (currentPage > 1) params.set("page", String(currentPage));
    if (selectedUF) params.set("uf", selectedUF);
    if (selectedMunicipio) params.set("municipio", selectedMunicipio);
    if (selectedBairro) params.set("bairro", selectedBairro);
    if (selectedStatus && selectedStatus !== "Todos os status") params.set("status", selectedStatus);
    if (selectedOrigem && selectedOrigem !== "Todas as origens") params.set("origem", selectedOrigem);
    if (selectedEmailAvailability !== "todos") params.set("email", selectedEmailAvailability);

    const newUrl = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ""}`;
    window.history.replaceState({}, "", newUrl);
  }, [
    searchQuery,
    currentPage,
    selectedUF,
    selectedMunicipio,
    selectedBairro,
    selectedStatus,
    selectedOrigem,
    selectedEmailAvailability,
  ]);

  const loadMockLeads = useCallback(async () => {
    if (isRealMode) return;
    setIsLoadingMock(true);
    try {
      const res = await fetchMockLeads({
        query: searchQuery,
        statusTab: "Todos",
        uf: selectedUF,
        municipio: selectedMunicipio,
        bairro: selectedBairro,
        statusSelect: selectedStatus,
        origem: selectedOrigem,
        emailAvailability: selectedEmailAvailability,
        page: currentPage,
        pageSize: 5,
      });

      setMockLeads(res.items);
      const hasSpecificFilter =
        Boolean(searchQuery) ||
        Boolean(selectedUF) ||
        selectedStatus !== "Todos os status" ||
        selectedOrigem !== "Todas as origens" ||
        selectedEmailAvailability !== "todos";

      setMockTotalLeads(hasSpecificFilter ? res.total : MOCK_SUMMARY.totalLeads);
      setMockTotalPages(hasSpecificFilter ? res.totalPages : Math.ceil(MOCK_SUMMARY.totalLeads / 5));
    } catch (err) {
      console.error("Falha ao consultar leads:", err);
    } finally {
      setIsLoadingMock(false);
    }
  }, [
    isRealMode,
    searchQuery,
    selectedUF,
    selectedMunicipio,
    selectedBairro,
    selectedStatus,
    selectedOrigem,
    selectedEmailAvailability,
    currentPage,
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

  // Dados calculados quando em modo real (SQLite Local ou Supabase Online)
  const realSummary = useMemo(
    () => (isRealMode ? computeSummaryFromItems(realLeads) : mockSummary),
    [isRealMode, realLeads, mockSummary]
  );

  const realPagination = useMemo(
    () =>
      isRealMode
        ? filterAndPaginateItems(realLeads, {
            query: searchQuery,
            statusTab: "Todos",
            uf: selectedUF,
            municipio: selectedMunicipio,
            bairro: selectedBairro,
            statusSelect: selectedStatus,
            origem: selectedOrigem,
            emailAvailability: selectedEmailAvailability,
            page: currentPage,
            pageSize: 5,
          })
        : null,
    [
      isRealMode,
      realLeads,
      searchQuery,
      selectedUF,
      selectedMunicipio,
      selectedBairro,
      selectedStatus,
      selectedOrigem,
      selectedEmailAvailability,
      currentPage,
    ]
  );

  const dynamicLocations = useMemo(
    () => (isRealMode && realLeads.length > 0 ? buildDynamicLocations(realLeads) : undefined),
    [isRealMode, realLeads]
  );

  const activeItems = isRealMode && realPagination ? realPagination.items : mockLeads;
  const activeTotal = isRealMode && realPagination ? realPagination.total : mockTotalLeads;
  const activeTotalPages = isRealMode && realPagination ? realPagination.totalPages : mockTotalPages;
  const activeSummary = isRealMode ? realSummary : mockSummary;
  const activeLoading = isRealMode ? isLoadingReal : isLoadingMock;

  const handleApplySideFilters = (filters: {
    uf: string;
    municipio: string;
    bairro: string;
    statusSelect: string;
    origem: string;
    emailAvailability: EmailAvailability;
  }) => {
    setSelectedUF(filters.uf);
    setSelectedMunicipio(filters.municipio);
    setSelectedBairro(filters.bairro);
    setSelectedStatus(filters.statusSelect);
    setSelectedOrigem(filters.origem);
    setSelectedEmailAvailability(filters.emailAvailability);
    setCurrentPage(1);
    setSelectedLeadIds([]);
  };

  const handleResetFilters = () => {
    setSelectedUF("");
    setSelectedMunicipio("");
    setSelectedBairro("");
    setSelectedStatus("Todos os status");
    setSelectedOrigem("Todas as origens");
    setSelectedEmailAvailability("todos");
    setCurrentPage(1);
  };

  const handleSingleStatusChange = async (id: string, newStatus: LeadStatus) => {
    if (isRealMode) {
      if (!await onStatusChange(id, newStatus)) return;
      setSelectedLeadIds((current) => current.filter((selectedId) => selectedId !== id));
      if (detailLead?.id === id) setDetailLead(null);
      return;
    } else {
      await updateLeadStatus(id, newStatus);
      void loadMockLeads();
    }
    if (detailLead && detailLead.id === id) {
      setDetailLead({ ...detailLead, status: newStatus });
    }
  };

  const handleBatchStatusChange = async (newStatus: LeadStatus) => {
    if (isRealMode) {
      const moved = await onBatchStatusChange(selectedLeadIds, newStatus);
      setSelectedLeadIds((current) => current.filter((id) => !moved.includes(id)));
      if (detailLead && moved.includes(detailLead.id)) setDetailLead(null);
      return;
    } else {
      await batchUpdateStatus(selectedLeadIds, newStatus);
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

  const handleBatchAssign = (responsible: string) => {
    if (isRealMode) {
      setBatchLeadResponsibleOverride(selectedLeadIds, responsible);
      onMutateRealLeads?.();
    } else {
      setMockLeads((current) =>
        current.map((lead) =>
          selectedLeadIds.includes(lead.id) ? { ...lead, responsavel: responsible } : lead
        )
      );
    }
    setSelectedLeadIds([]);
  };

  const handleExportCSV = (exportItems?: LeadItem[]) => {
    const dataToExport = exportItems && exportItems.length ? exportItems : activeItems;
    downloadLeadsCsv(dataToExport, "pharmaleads_export");
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

        <button
          onClick={onNewProspect}
          className={cn(ui.btnBrand, "h-12 px-6 sm:px-8 text-sm sm:text-base shrink-0")}
        >
          <Plus size={18} strokeWidth={2.5} />
          <span>Nova Prospecção</span>
        </button>
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
      {isRealMode && realError && (
        <div
          role="alert"
          className="p-4 rounded-2xl bg-surface border border-border flex items-center justify-between gap-3 text-xs text-foreground"
        >
          <span className="flex items-center gap-2 font-medium">
            <AlertCircle size={16} className="text-brand shrink-0" />
            {realError}
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
        </div>
      )}

      {/* 4. Quatro cards de métricas em linha */}
      <MetricsCards summary={activeSummary} isLoading={activeLoading && !activeItems.length} />

      {/* Filtros e tabela ocupam a largura principal sem a coluna lateral. */}
      <div className={cn(ui.cardInteractive, "w-full overflow-hidden flex flex-col")}>
        <div className="p-4 md:p-6 border-b border-border">
          <FiltersSidebar
            key={`${selectedUF}|${selectedMunicipio}|${selectedBairro}|${selectedStatus}|${selectedOrigem}|${selectedEmailAvailability}`}
            selectedUF={selectedUF}
            selectedMunicipio={selectedMunicipio}
            selectedBairro={selectedBairro}
            selectedStatus={selectedStatus}
            selectedOrigem={selectedOrigem}
            selectedEmailAvailability={selectedEmailAvailability}
            onApplyFilters={handleApplySideFilters}
            onResetFilters={handleResetFilters}
            dynamicLocations={dynamicLocations}
          />
        </div>

        <LeadsTable
            items={activeItems}
            total={activeTotal}
            currentPage={currentPage}
            totalPages={activeTotalPages}
            isLoading={activeLoading}
            onPageChange={(page) => setCurrentPage(page)}
            onViewDetails={(lead) => setDetailLead(lead)}
            onChangeStatus={handleSingleStatusChange}
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
        onClearSelection={() => setSelectedLeadIds([])}
        onBatchStatusChange={handleBatchStatusChange}
        onBatchExportCSV={() => {
          const selectedItems = activeItems.filter((item) => selectedLeadIds.includes(item.id));
          handleExportCSV(selectedItems);
        }}
        onBatchAssignResponsible={handleBatchAssign}
      />

      {/* Modal de Detalhes do Lead */}
      <LeadDetailsModal
        lead={detailLead}
        onClose={() => setDetailLead(null)}
        onChangeStatus={handleSingleStatusChange}
      />


    </div>
  );
}
