import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Sidebar, type NavTab } from "./components/layout/Sidebar";
import { Topbar } from "./components/layout/Topbar";
import { LeadsView } from "./components/leads/LeadsView";
import { LeadDetailsModal } from "./components/leads/LeadDetailsModal";
import { ProspeccaoTab } from "./components/prospeccao/ProspeccaoTab";
import { CrmTab } from "./components/crm/CrmTab";
import { ConfigTab } from "./components/config/ConfigTab";
import { RelatoriosTab } from "./components/relatorios/RelatoriosTab";
import { HelpModal } from "./components/help/HelpModal";
import { useTheme } from "./lib/theme";
import { downloadLeadsCsv } from "./lib/csv";
import type { Lead } from "./lib/crm";
import {
  AccessError,
  authenticateSupabase,
  clearSupabaseSession,
  computeSummaryFromItems,
  fetchLocalAllLeads,
  fetchLocalApiStatus,
  fetchSupabaseAllLeads,
  mapRawLeadsToItems,
  savedSupabaseSession,
  setLeadCrmMembershipOverride,
  setLeadStatusOverride,
  type DataSourceMode,
  type SupabaseSession,
} from "./lib/backend";
import type { LeadItem, LeadStatus } from "./lib/mock-leads";

export function App() {
  const { theme, toggleTheme } = useTheme();
  const [activeTab, setActiveTab] = useState<NavTab>("leads");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [collectionRequest, setCollectionRequest] = useState<{ id: number; local: string } | null>(null);
  const collectionRequestId = useRef(0);

  // Sessão Supabase e modo de fonte de dados
  const [supabaseSession, setSupabaseSession] = useState<SupabaseSession | null>(
    savedSupabaseSession
  );
  const [dataSourceMode, setDataSourceMode] = useState<DataSourceMode>(() => {
    if (savedSupabaseSession()) return "supabase";
    if (
      typeof window !== "undefined" &&
      import.meta.env.MODE !== "test" &&
      window.location.hostname &&
      !["127.0.0.1", "localhost"].includes(window.location.hostname)
    ) {
      return "supabase";
    }
    return "mock";
  });

  // Dados reais carregados (SQLite Local ou Supabase Online)
  const [rawLocalRows, setRawLocalRows] = useState<Lead[]>([]);
  const [rawSupabaseRows, setRawSupabaseRows] = useState<Lead[]>([]);
  const [isLoadingReal, setIsLoadingReal] = useState(false);
  const [realError, setRealError] = useState("");
  const [overrideVersion, setOverrideVersion] = useState(0);

  const [selectedCrmLead, setSelectedCrmLead] = useState<LeadItem | null>(null);

  // Auto-detecta API Python local (127.0.0.1:8765) quando rodando no navegador fora de testes unitários
  useEffect(() => {
    if (import.meta.env.MODE === "test" || savedSupabaseSession()) return;
    let cancelled = false;
    fetchLocalApiStatus()
      .then((status) => {
        if (!cancelled && status) {
          setDataSourceMode("local");
        }
      })
      .catch(() => {
        // Permanece em modo mock caso a API local não esteja rodando
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Carrega todos os leads do SQLite Local
  const loadLocalLeads = useCallback(async () => {
    setIsLoadingReal(true);
    setRealError("");
    try {
      const rows = await fetchLocalAllLeads();
      setRawLocalRows(rows);
    } catch (err) {
      setRealError(
        err instanceof Error
          ? err.message
          : "Não foi possível conectar à API local (execute python -m pharmaleads.api)."
      );
    } finally {
      setIsLoadingReal(false);
    }
  }, []);

  // Carrega todos os leads do Supabase Online
  const loadSupabaseLeads = useCallback(
    async (sessionOverride?: SupabaseSession | null) => {
      const currentSession = sessionOverride ?? supabaseSession;
      if (!currentSession) return;
      setIsLoadingReal(true);
      setRealError("");
      try {
        const res = await fetchSupabaseAllLeads(currentSession);
        setSupabaseSession(res.session);
        setRawSupabaseRows(res.rows);
      } catch (err) {
        setRealError(
          err instanceof Error ? err.message : "Falha ao consultar public.pharmaleads no Supabase."
        );
        if (err instanceof AccessError) {
          clearSupabaseSession();
          setSupabaseSession(null);
        }
      } finally {
        setIsLoadingReal(false);
      }
    },
    [supabaseSession]
  );

  // Dispara carregamento quando o modo muda para local ou supabase
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      if (dataSourceMode === "local") {
        void loadLocalLeads();
      } else if (dataSourceMode === "supabase" && supabaseSession) {
        void loadSupabaseLeads(supabaseSession);
      }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataSourceMode, Boolean(supabaseSession)]);

  const handleRefreshActiveData = useCallback(() => {
    if (dataSourceMode === "local") {
      void loadLocalLeads();
    } else if (dataSourceMode === "supabase" && supabaseSession) {
      void loadSupabaseLeads(supabaseSession);
    }
  }, [dataSourceMode, supabaseSession, loadLocalLeads, loadSupabaseLeads]);

  // Mapeia os leads brutos da fonte ativa aplicando overrides de status/responsável do CRM
  const realLeads = useMemo(() => {
    void overrideVersion; // Recomputa quando há mudança de status/responsável/exclusão
    if (dataSourceMode === "local") return mapRawLeadsToItems(rawLocalRows);
    if (dataSourceMode === "supabase") return mapRawLeadsToItems(rawSupabaseRows);
    return [];
  }, [dataSourceMode, rawLocalRows, rawSupabaseRows, overrideVersion]);

  const activeLeadsForCrm = realLeads.filter((lead) => lead.crmIncluded);
  const activeSummaryForReports = useMemo(
    () => computeSummaryFromItems(realLeads),
    [realLeads]
  );

  const handleCrmStatusChange = async (id: string, newStatus: LeadStatus) => {
    setLeadStatusOverride(id, newStatus);
    setOverrideVersion((v) => v + 1);
    if (selectedCrmLead?.id === id) {
      setSelectedCrmLead({ ...selectedCrmLead, status: newStatus });
    }
  };

  const handleCrmMembershipChange = (id: string, included: boolean) => {
    setLeadCrmMembershipOverride(id, included);
    if (!included && selectedCrmLead?.id === id) setSelectedCrmLead(null);
    setOverrideVersion((v) => v + 1);
  };

  const handleSignInSupabase = async (email: string, password: string) => {
    const session = await authenticateSupabase("password", { email, password });
    setSupabaseSession(session);
    setDataSourceMode("supabase");
    await loadSupabaseLeads(session);
  };

  const handleSignOutSupabase = () => {
    clearSupabaseSession();
    setSupabaseSession(null);
    setRawSupabaseRows([]);
    setRealError("");
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col lg:flex-row font-sans transition-colors duration-200">
      {/* 1. Sidebar Fixa à Esquerda (260px) + Drawer Mobile */}
      <Sidebar
        activeTab={activeTab}
        onSelectTab={(tab) => setActiveTab(tab)}
        onOpenHelp={() => setIsHelpOpen(true)}
        isOpenMobile={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
      />

      {/* Conteúdo Principal (à direita da sidebar de 260px no desktop) */}
      <div className="flex-1 lg:pl-[260px] flex flex-col min-h-screen min-w-0 bg-background">
        {/* 2. Topbar com seletor de tema Claro/Escuro e status da conexão */}
        <Topbar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onToggleMobileMenu={() => setIsMobileMenuOpen(true)}
          theme={theme}
          onToggleTheme={toggleTheme}
          dataSourceMode={dataSourceMode}
          isSupabaseAuthenticated={Boolean(supabaseSession)}
          isLoadingData={isLoadingReal}
          onRefreshData={handleRefreshActiveData}
          onOpenConfig={() => setActiveTab("config")}
          onSignOutSupabase={handleSignOutSupabase}
        />

        {/* 3. Área de Conteúdo */}
        <main className="flex-1 p-4 sm:p-6 md:p-8 max-w-[1600px] w-full mx-auto safe-pb">
          {activeTab === "leads" && (
            <LeadsView
              searchQuery={searchQuery}
              dataSourceMode={dataSourceMode}
              realLeads={realLeads}
              isLoadingReal={isLoadingReal}
              realError={realError}
              isSupabaseAuthenticated={Boolean(supabaseSession)}
              onMutateRealLeads={() => setOverrideVersion((v) => v + 1)}
              onOpenConfig={() => setActiveTab("config")}
              onCrmMembershipChange={handleCrmMembershipChange}
              onStartProspectAction={(data) => {
                const local = `${data.municipio}, ${data.uf}`;
                collectionRequestId.current += 1;
                setCollectionRequest({ id: collectionRequestId.current, local });
                setActiveTab("prospeccao");
              }}
            />
          )}

          {activeTab === "prospeccao" && (
            <ProspeccaoTab
              dataSourceMode={dataSourceMode}
              supabaseSession={supabaseSession}
              onSessionUpdate={setSupabaseSession}
              realLeads={realLeads}
              onRefreshLeads={handleRefreshActiveData}
              collectionRequest={collectionRequest}
            />
          )}

          {activeTab === "crm" && (
            <CrmTab
              leads={activeLeadsForCrm}
              searchQuery={searchQuery}
              onStatusChange={handleCrmStatusChange}
              onRemoveFromCrm={(id) => handleCrmMembershipChange(id, false)}
              onSelectLead={(lead) => setSelectedCrmLead(lead)}
            />
          )}

          {activeTab === "config" && (
            <ConfigTab
              dataSourceMode={dataSourceMode}
              onToggleDataSource={setDataSourceMode}
              supabaseSession={supabaseSession}
              onSignInSupabase={handleSignInSupabase}
              onSignOutSupabase={handleSignOutSupabase}
              localLeadsCount={rawLocalRows.length || null}
              supabaseLeadsCount={rawSupabaseRows.length || null}
            />
          )}

          {activeTab === "relatorios" && (
            <RelatoriosTab
              summary={activeSummaryForReports}
              leads={dataSourceMode === "mock" ? undefined : realLeads}
              onExportFullCSV={() => {
                if (dataSourceMode === "local") {
                  window.open("/api/exportar", "_blank");
                  return;
                }
                downloadLeadsCsv(activeLeadsForCrm, "pharmaleads_relatorio_completo");
              }}
            />
          )}
        </main>
      </div>

      {/* Modal de Detalhes no CRM */}
      <LeadDetailsModal
        lead={selectedCrmLead}
        onClose={() => setSelectedCrmLead(null)}
        onChangeStatus={handleCrmStatusChange}
      />

      {/* Modal de Ajuda */}
      <HelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
    </div>
  );
}

export default App;
