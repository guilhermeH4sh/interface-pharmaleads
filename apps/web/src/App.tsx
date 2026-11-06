import { useCallback, useEffect, useMemo, useState } from "react";
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
  fetchSupabaseAllLeads,
  mapRawLeadsToItems,
  savedSupabaseSession,
  setLeadCrmMembershipOverride,
  setLeadStatusOverride,
  updateSupabaseCrmLead,
  type DataSourceMode,
  type SupabaseSession,
} from "./lib/backend";
import type { LeadItem, LeadStatus } from "./lib/mock-leads";

export function App() {
  const { theme, toggleTheme } = useTheme();
  const [activeTab, setActiveTab] = useState<NavTab>("prospeccao");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);


  // Sessão Supabase e modo de fonte de dados
  const [supabaseSession, setSupabaseSession] = useState<SupabaseSession | null>(
    savedSupabaseSession
  );
  const [dataSourceMode] = useState<DataSourceMode>("supabase");

  // Dados reais carregados (SQLite Local ou Supabase Online)
  const [rawLocalRows, setRawLocalRows] = useState<Lead[]>([]);
  const [rawSupabaseRows, setRawSupabaseRows] = useState<Lead[]>([]);
  const [isLoadingReal, setIsLoadingReal] = useState(false);
  const [realError, setRealError] = useState("");
  const [overrideVersion, setOverrideVersion] = useState(0);

  const [selectedCrmLead, setSelectedCrmLead] = useState<LeadItem | null>(null);

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
      } else if (dataSourceMode === "supabase" && supabaseSession && ["leads", "crm", "relatorios"].includes(activeTab)) {
        void loadSupabaseLeads(supabaseSession);
      }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataSourceMode, Boolean(supabaseSession), activeTab]);

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

  const leadsOutsideCrm = useMemo(() => realLeads.filter(lead => !lead.crmIncluded), [realLeads]);
  const activeLeadsForCrm = realLeads.filter((lead) => lead.crmIncluded);
  const activeSummaryForReports = useMemo(
    () => computeSummaryFromItems(realLeads),
    [realLeads]
  );

  const handleCrmStatusChange = async (id: string, newStatus: LeadStatus) => {
    if (dataSourceMode === "supabase") {
      if (!supabaseSession) {
        setRealError("Entre no Supabase para salvar o status do CRM.");
        return;
      }
      try {
        const result = await updateSupabaseCrmLead(supabaseSession, id, { crm_status: newStatus });
        setSupabaseSession(result.session);
        setRawSupabaseRows((rows) => rows.map((row) => row.chave === id ? { ...row, crm_status: newStatus } : row));
        setRealError("");
      } catch (err) {
        setRealError(err instanceof Error ? err.message : "Não foi possível salvar o status no Supabase.");
        return;
      }
    } else {
      setLeadStatusOverride(id, newStatus);
    }
    setOverrideVersion((v) => v + 1);
    if (selectedCrmLead?.id === id) {
      setSelectedCrmLead({ ...selectedCrmLead, status: newStatus });
    }
  };

  const handleCrmMembershipChange = async (id: string, included: boolean) => {
    if (dataSourceMode === "supabase") {
      if (!supabaseSession) {
        setRealError("Entre no Supabase para adicionar ou remover leads do CRM.");
        return;
      }
      try {
        const result = await updateSupabaseCrmLead(supabaseSession, id, { crm_included: included });
        setSupabaseSession(result.session);
        setRawSupabaseRows((rows) => rows.map((row) => row.chave === id ? { ...row, crm_included: included } : row));
        setRealError("");
      } catch (err) {
        setRealError(err instanceof Error ? err.message : "Não foi possível atualizar a participação no CRM.");
        return;
      }
    } else if (dataSourceMode === "local") {
      setLeadCrmMembershipOverride(id, included);
    } else {
      setRealError("Conecte uma fonte real para incluir leads no CRM.");
      return;
    }
    if (!included && selectedCrmLead?.id === id) setSelectedCrmLead(null);
    setOverrideVersion((v) => v + 1);
  };

  const handleSignInSupabase = async (email: string, password: string) => {
    const session = await authenticateSupabase("password", { email, password });
    setSupabaseSession(session);
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
      <div className="flex-1 lg:pl-[220px] flex flex-col min-h-screen min-w-0 bg-background">
        {/* 2. Topbar com seletor de tema Claro/Escuro e status da conexão */}
        <Topbar
          onToggleMobileMenu={() => setIsMobileMenuOpen(true)}
          theme={theme}
          onToggleTheme={toggleTheme}
          dataSourceMode={dataSourceMode}
          isSupabaseAuthenticated={Boolean(supabaseSession)}
          isLoadingData={isLoadingReal}
          onRefreshData={handleRefreshActiveData}
          onOpenConfig={() => setActiveTab("config")}
        />

        {/* 3. Área de Conteúdo */}
        <main className="flex-1 p-4 sm:p-6 md:p-8 max-w-[1600px] w-full mx-auto safe-pb">
          {activeTab === "leads" && (
            <LeadsView
              searchQuery=""
              dataSourceMode={dataSourceMode}
              realLeads={leadsOutsideCrm}
              isLoadingReal={isLoadingReal}
              realError={realError}
              isSupabaseAuthenticated={Boolean(supabaseSession)}
              onMutateRealLeads={() => setOverrideVersion((v) => v + 1)}
              onOpenConfig={() => setActiveTab("config")}
              onCrmMembershipChange={handleCrmMembershipChange}
              onNewProspect={() => setActiveTab("prospeccao")}
            />
          )}

          {activeTab === "prospeccao" && (
            <ProspeccaoTab
              dataSourceMode={dataSourceMode}
              supabaseSession={supabaseSession}
              onSessionUpdate={setSupabaseSession}
              onRefreshLeads={handleRefreshActiveData}
              onOpenLeads={() => setActiveTab("leads")}
            />
          )}

          {activeTab === "crm" && (
            <CrmTab
              leads={activeLeadsForCrm}
              availableLeads={realLeads}
              onAddToCrm={(id) => handleCrmMembershipChange(id, true)}
              onStatusChange={handleCrmStatusChange}
              onRemoveFromCrm={(id) => handleCrmMembershipChange(id, false)}
              errorMessage={realError}
              onSelectLead={(lead) => setSelectedCrmLead(lead)}
            />
          )}

          {activeTab === "config" && (
            <ConfigTab
              supabaseSession={supabaseSession}
              onSignInSupabase={handleSignInSupabase}
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
