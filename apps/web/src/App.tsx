import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Sidebar, type NavTab } from "./components/layout/Sidebar";
import { Topbar } from "./components/layout/Topbar";
import { LeadsView } from "./components/leads/LeadsView";
import { LeadDetailsModal } from "./components/leads/LeadDetailsModal";
import { ProspeccaoTab } from "./components/prospeccao/ProspeccaoTab";
import { CrmTab } from "./components/crm/CrmTab";
import { LoginPage } from "./components/auth/LoginPage";
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
  verifyPlatformSession,
  setLeadCrmMembershipOverride,
  setLeadStatusOverride,
  updateSupabaseCrmLead,
  type DataSourceMode,
  type SupabaseSession,
} from "./lib/backend";
import type { LeadItem, LeadStatus } from "./lib/mock-leads";

export function App() {
  const [session, setSession] = useState<SupabaseSession | null>(savedSupabaseSession);
  const [checking, setChecking] = useState(() => Boolean(savedSupabaseSession()));
  const [message, setMessage] = useState("");
  const [retry, setRetry] = useState(0);
  const [validationError, setValidationError] = useState("");
  const [verified, setVerified] = useState(false);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    verifyPlatformSession(session).then(active => {
      if (cancelled) return;
      setSession(active); setVerified(true); setChecking(false); setValidationError("");
    }).catch(cause => {
      if (cancelled) return;
      setChecking(false);
      if (cause instanceof AccessError) {
        clearSupabaseSession(); setSession(null); setVerified(false);
        setMessage("Sua sessão expirou. Entre novamente na plataforma.");
      } else {
        setValidationError("Não foi possível validar o acesso. Verifique sua conexão e tente novamente.");
      }
    });
    return () => { cancelled = true; };
  }, [session, retry]);

  const signOut = useCallback(() => {
    clearSupabaseSession(); setSession(null); setVerified(false); setChecking(false);
    setValidationError(""); setMessage("");
  }, []);
  if (checking || (session && !verified)) return (
    <main className="min-h-dvh bg-background text-foreground flex flex-col items-center justify-center gap-4 p-6">
      <p role="status">{validationError || "Validando seu acesso..."}</p>
      {validationError && <button className="text-brand underline" onClick={() => { setValidationError(""); setChecking(true); setRetry(value => value + 1); }}>Tentar novamente</button>}
    </main>
  );
  if (!session) return <LoginPage message={message} onSignIn={async (email, password) => {
    const active = await authenticateSupabase("password", { email, password });
    setMessage(""); setSession(active); setVerified(true);
  }} />;
  return <PlatformDashboard initialSession={session} onSignOut={signOut} />;
}

export function PlatformDashboard({ initialSession, onSignOut }: { initialSession: SupabaseSession; onSignOut: () => void }) {
  const { theme, toggleTheme } = useTheme();
  const [activeTab, setActiveTab] = useState<NavTab>("prospeccao");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);


  // Sessão Supabase e modo de fonte de dados
  const [supabaseSession, setSupabaseSession] = useState<SupabaseSession | null>(
    initialSession
  );
  const [dataSourceMode] = useState<DataSourceMode>("supabase");

  // Dados reais carregados (SQLite Local ou Supabase Online)
  const [rawLocalRows, setRawLocalRows] = useState<Lead[]>([]);
  const [rawSupabaseRows, setRawSupabaseRows] = useState<Lead[]>([]);
  const [isLoadingReal, setIsLoadingReal] = useState(false);
  const [realError, setRealError] = useState("");
  const [overrideVersion, setOverrideVersion] = useState(0);

  const [selectedCrmLead, setSelectedCrmLead] = useState<LeadItem | null>(null);
  const lastSupabaseLoad = useRef(0);
  const supabaseLoadInProgress = useRef(false);

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
      if (supabaseLoadInProgress.current) return;
      supabaseLoadInProgress.current = true;
      setIsLoadingReal(true);
      setRealError("");
      try {
        const res = await fetchSupabaseAllLeads(currentSession);
        setSupabaseSession(res.session);
        setRawSupabaseRows(res.rows);
        lastSupabaseLoad.current = Date.now();
      } catch (err) {
        setRealError(
          err instanceof Error ? err.message : "Falha ao consultar public.pharmaleads no Supabase."
        );
        if (err instanceof AccessError) {
          clearSupabaseSession();
          setSupabaseSession(null);
          onSignOut();
        }
      } finally {
        supabaseLoadInProgress.current = false;
        setIsLoadingReal(false);
      }
    },
    [supabaseSession, onSignOut]
  );

  // Dispara carregamento quando o modo muda para local ou supabase
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      if (dataSourceMode === "local") {
        void loadLocalLeads();
      } else if (dataSourceMode === "supabase" && supabaseSession && ["leads", "crm", "relatorios"].includes(activeTab) && Date.now() - lastSupabaseLoad.current > 60_000) {
        void loadSupabaseLeads(supabaseSession);
      }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataSourceMode, Boolean(supabaseSession), activeTab]);

  const handleRefreshActiveData = useCallback(async () => {
    if (dataSourceMode === "local") {
      await loadLocalLeads();
    } else if (dataSourceMode === "supabase" && supabaseSession) {
      await loadSupabaseLeads(supabaseSession);
    }
  }, [dataSourceMode, supabaseSession, loadLocalLeads, loadSupabaseLeads]);

  // Mapeia os leads brutos da fonte ativa aplicando overrides locais quando necessários
  const realLeads = useMemo(() => {
    void overrideVersion; // Recomputa quando há mudança de status ou exclusão local
    if (dataSourceMode === "local") return mapRawLeadsToItems(rawLocalRows);
    if (dataSourceMode === "supabase") return mapRawLeadsToItems(rawSupabaseRows);
    return [];
  }, [dataSourceMode, rawLocalRows, rawSupabaseRows, overrideVersion]);

  const leadsOutsideCrm = useMemo(() => realLeads.filter(lead => !lead.crmIncluded && lead.status === "Não contatado"), [realLeads]);
  const activeLeadsForCrm = realLeads.filter((lead) => lead.crmIncluded || lead.status !== "Não contatado");
  const activeSummaryForReports = useMemo(
    () => computeSummaryFromItems(realLeads),
    [realLeads]
  );

  const handleCrmStatusChange = async (id: string, newStatus: LeadStatus): Promise<boolean> => {
    const included = newStatus !== "Não contatado";
    if (dataSourceMode === "supabase") {
      if (!supabaseSession) {
        setRealError("Entre no Supabase para salvar o status do CRM.");
        return false;
      }
      try {
        const result = await updateSupabaseCrmLead(supabaseSession, id, { crm_status: newStatus, crm_included: included });
        if (result.row.crm_status !== newStatus || result.row.crm_included !== included) throw new Error("O Supabase não confirmou a atualização do status.");
        setSupabaseSession(result.session);
        setRawSupabaseRows((rows) => rows.map((row) => row.chave === id ? result.row : row));
        setRealError("");
      } catch (err) {
        if (err instanceof AccessError) onSignOut();
        setRealError(err instanceof Error ? err.message : "Não foi possível salvar o status no Supabase.");
        return false;
      }
    } else {
      setLeadStatusOverride(id, newStatus);
      setLeadCrmMembershipOverride(id, included);
    }
    setOverrideVersion((v) => v + 1);
    if (selectedCrmLead?.id === id) setSelectedCrmLead(included ? { ...selectedCrmLead, status: newStatus, crmIncluded: true } : null);
    return true;
  };

  const handleBatchAddToCrm = async (ids: string[]): Promise<string[]> => {
    const moved: string[] = [];
    for (const id of ids) {
      if (await handleCrmMembershipChange(id, true)) moved.push(id);
    }
    if (moved.length < ids.length) setRealError("Alguns leads não foram atualizados. Verifique os selecionados e tente novamente.");
    return moved;
  };

  const handleCrmMembershipChange = async (id: string, included: boolean): Promise<boolean> => {
    const newStatus: LeadStatus = included ? "Em contato" : "Não contatado";
    if (dataSourceMode === "supabase") {
      if (!supabaseSession) {
        setRealError("Entre no Supabase para adicionar ou remover leads do CRM.");
        return false;
      }
      try {
        const result = await updateSupabaseCrmLead(supabaseSession, id, { crm_included: included, crm_status: newStatus });
        if (result.row.crm_included !== included || result.row.crm_status !== newStatus) throw new Error("O Supabase não confirmou a alteração do CRM.");
        setSupabaseSession(result.session);
        setRawSupabaseRows((rows) => rows.map((row) => row.chave === id ? result.row : row));
        setRealError("");
      } catch (err) {
        if (err instanceof AccessError) onSignOut();
        setRealError(err instanceof Error ? err.message : "Não foi possível atualizar a participação no CRM.");
        return false;
      }
    } else if (dataSourceMode === "local") {
      setLeadCrmMembershipOverride(id, included);
      setLeadStatusOverride(id, newStatus);
    } else {
      setRealError("Conecte uma fonte real para incluir leads no CRM.");
      return false;
    }
    if (!included && selectedCrmLead?.id === id) setSelectedCrmLead(null);
    setOverrideVersion((v) => v + 1);
    return true;
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col lg:flex-row font-sans transition-colors duration-200">
      {/* 1. Sidebar Fixa à Esquerda (260px) + Drawer Mobile */}
      <Sidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
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
          onSignOut={onSignOut}
          userEmail={supabaseSession?.email}
        />

        {/* 3. Área de Conteúdo */}
        <main className="flex-1 p-4 sm:p-6 md:p-8 max-w-[1600px] w-full mx-auto safe-pb">
          {activeTab === "leads" && (
            <LeadsView
              searchQuery=""
              dataSourceMode={dataSourceMode}
              realLeads={leadsOutsideCrm}
              allLeadsSummary={activeSummaryForReports}
              isLoadingReal={isLoadingReal}
              realError={realError}
              isSupabaseAuthenticated={Boolean(supabaseSession)}
              onMutateRealLeads={() => setOverrideVersion((v) => v + 1)}
              onOpenConfig={() => setActiveTab("config")}
              onCrmMembershipChange={handleCrmMembershipChange}
              onBatchAddToCrm={handleBatchAddToCrm}
              onNewProspect={() => setActiveTab("prospeccao")}
            />
          )}

          {activeTab === "prospeccao" && (
            <ProspeccaoTab
              dataSourceMode={dataSourceMode}
              supabaseSession={supabaseSession}
              onSessionUpdate={setSupabaseSession}
              onRefreshLeads={handleRefreshActiveData}
              onSessionInvalid={onSignOut}
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
              theme={theme}
              onToggleTheme={toggleTheme}
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
                downloadLeadsCsv(realLeads, "pharmaleads_relatorio_completo");
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
