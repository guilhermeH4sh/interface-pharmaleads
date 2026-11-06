# Entrega: pesquisa na aba Prospecção

## 1. Adaptações ao sistema real
- React 19, TypeScript, Vite e Tailwind, com componentes próprios e ícones Lucide. Estilos e sessão Supabase existentes reaproveitados; nenhuma dependência adicionada.
- O App usa abas, não rotas individuais: Prospecção passa a ser a aba inicial de / e o primeiro item do menu; os demais caminhos continuam sob o mesmo BrowserRouter.
- Fontes: todos os registros atuais têm origem Gosom/Google Maps; não existe coluna de origem. Os quatro filtros aparecem, mas fontes ainda não integradas retornam vazio quando Maps não está selecionado. Selecionar Maps junto com outra fonte inclui os registros Maps, respeitando OR no grupo.
- Status: a consulta usa crm_status. A opção Não qualificado aparece, mas o esquema atual aceita apenas os quatro status existentes, portanto não haverá registros nessa opção. Não alterei o esquema nem os status do CRM.
- Estado: filtro aplicado no servidor ao sufixo UF de local_busca (local de prospecção), pois não existe coluna UF separada. Isso representa a região buscada, não uma geocodificação independente do endereço.
- Links: site/rede social registrado em site, link do Maps e WhatsApp são exibidos quando disponíveis. Não foram inventadas colunas de redes sociais.
- Supabase: paginação de 25 registros com count=exact. Fonte local: utiliza os dados já carregados com paginação em memória, sinalizada na tela.

## 2. Análise do código atual
1. App.tsx controla navegação, autenticação e dados das abas.
2. Sidebar.tsx contém os itens do menu.
3. Topbar.tsx mantinha pesquisa global com debounce; ambos foram removidos.
4. A sessão e a renovação de JWT permanecem em lib/backend.ts.
5. A nova consulta REST reutiliza essa sessão e consulta somente public.pharmaleads.
6. ProspeccaoTab conserva iniciar/parar/polling da coleta local ou GitHub Actions.
7. A coleta fica em details recolhível abaixo da pesquisa, aberta quando há execução ativa.
8. Leads e CRM conservam seus componentes e suas ações; a pesquisa global foi retirada conforme solicitado.
9. A base inteira não é baixada na entrada da pesquisa online; o carregamento anterior permanece para as abas que o utilizam.
10. Nenhuma coleta real foi disparada durante os testes.

## 3. Alterações por arquivo
- App.tsx: aba inicial, remoção do estado global de pesquisa e carregamento completo sob demanda.
- Sidebar.tsx: Prospecção antes de Leads.
- Topbar.tsx: remove campo/debounce/props da pesquisa e preserva conexão, atualização, tema, notificações e usuário.
- ProspeccaoTab.tsx: adiciona pesquisa e mantém coletor em seção recolhível; evita atualizar a base inteira ao apenas consultar uma execução antiga concluída.
- ProspectSearch.tsx: formulário, tabela, estados, título e paginação.
- ProspectMultiSelect.tsx: seleção múltipla acessível com pesquisa, checkboxes e fechamento por Escape ou clique externo.
- prospect-search.ts: opções tipadas, filtros PostgREST validados, paginação e contagem exata.
- Testes: atualizados para a tela inicial atual e acrescentadas verificações de filtros, contatos, paginação e coleta.

## 4. Código completo por arquivo

### apps/web/src/App.tsx

```tsx
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
    setDataSourceMode("supabase");
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
          onSignOutSupabase={handleSignOutSupabase}
        />

        {/* 3. Área de Conteúdo */}
        <main className="flex-1 p-4 sm:p-6 md:p-8 max-w-[1600px] w-full mx-auto safe-pb">
          {activeTab === "leads" && (
            <LeadsView
              searchQuery=""
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
              onStatusChange={handleCrmStatusChange}
              onRemoveFromCrm={(id) => handleCrmMembershipChange(id, false)}
              errorMessage={realError}
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
```

### apps/web/src/components/layout/Sidebar.tsx

```tsx
import { useEffect, type ComponentType } from "react";
import { Users, Search, Calendar, Settings, BarChart3, HelpCircle, X } from "lucide-react";
import { Logo } from "../logo";
import { cn } from "../../lib/utils";

export type NavTab = "leads" | "prospeccao" | "crm" | "config" | "relatorios";

interface SidebarProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  onOpenHelp: () => void;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
}

const NAV_ITEMS: { id: NavTab; label: string; icon: ComponentType<{ size?: number; className?: string }> }[] = [
  { id: "prospeccao", label: "Prospecção", icon: Search },
  { id: "leads", label: "Leads", icon: Users },
  { id: "crm", label: "CRM", icon: Calendar },
  { id: "config", label: "Configurações", icon: Settings },
  { id: "relatorios", label: "Relatórios", icon: BarChart3 },
];

const itemBase =
  "w-full flex items-center gap-3 px-4 h-11 rounded-xl text-sm font-medium transition-all duration-200";

export function Sidebar({ activeTab, onSelectTab, onOpenHelp, isOpenMobile = false, onCloseMobile }: SidebarProps) {
  // Esc fecha o drawer no mobile
  useEffect(() => {
    if (!isOpenMobile) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCloseMobile?.();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpenMobile, onCloseMobile]);

  const content = (
    <div className="flex flex-col h-full p-5">
      <div className="flex items-center justify-between h-12">
        <Logo size={38} />
        {isOpenMobile && onCloseMobile && (
          <button
            onClick={onCloseMobile}
            aria-label="Fechar menu"
            className="lg:hidden w-10 h-10 inline-flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
          >
            <X size={20} />
          </button>
        )}
      </div>

      <p className="mt-8 mb-2 px-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Menu</p>
      <nav className="flex flex-col gap-1" aria-label="Navegação principal">
        {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
          const isActive = activeTab === id;
          return (
            <button
              key={id}
              aria-current={isActive ? "page" : undefined}
              onClick={() => {
                onSelectTab(id);
                onCloseMobile?.();
              }}
              className={cn(
                itemBase,
                isActive
                  ? "bg-primary text-primary-foreground font-semibold shadow-[var(--shadow-primary)]"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              <Icon size={19} />
              <span>{label}</span>
            </button>
          );
        })}
      </nav>

      <div className="mt-auto pt-4 border-t border-border space-y-3">
        <button onClick={onOpenHelp} className={cn(itemBase, "text-muted-foreground hover:text-foreground hover:bg-muted")}>
          <HelpCircle size={19} />
          <span>Ajuda</span>
        </button>
        <p className="px-4 text-[11px] text-muted-foreground">© Centrus AI · Inteligência Farmacêutica</p>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop: menu compacto para liberar espaço para a área de trabalho */}
      <aside className="hidden lg:flex flex-col w-[220px] h-dvh fixed left-0 top-0 bg-card border-r border-border z-30">
        {content}
      </aside>

      {/* Mobile/tablet: drawer */}
      {isOpenMobile && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in" onClick={onCloseMobile} aria-hidden="true" />
          <aside
            role="dialog"
            aria-modal="true"
            aria-label="Menu de navegação"
            className="relative w-[248px] max-w-[85vw] h-full bg-card border-r border-border shadow-[var(--shadow-pop)] animate-slide-in"
          >
            {content}
          </aside>
        </div>
      )}
    </>
  );
}
```

### apps/web/src/components/layout/Topbar.tsx

```tsx
import { useEffect, useRef, useState } from "react";
import {
  Bell,
  ChevronDown,
  Menu,
  User,
  LogOut,
  ShieldCheck,
  Sun,
  Moon,
  Database,
  RefreshCw,
} from "lucide-react";
import type { Theme } from "../../lib/theme";
import type { DataSourceMode } from "../../lib/backend";
import { ui } from "../../lib/ui";
import { cn } from "../../lib/utils";

interface TopbarProps {
  onToggleMobileMenu: () => void;
  theme: Theme;
  onToggleTheme: () => void;
  dataSourceMode?: DataSourceMode;
  isSupabaseAuthenticated?: boolean;
  isLoadingData?: boolean;
  onRefreshData?: () => void;
  onOpenConfig?: () => void;
  onSignOutSupabase?: () => void;
}

export function Topbar({
  onToggleMobileMenu,
  theme,
  onToggleTheme,
  dataSourceMode = "mock",
  isSupabaseAuthenticated = false,
  isLoadingData = false,
  onRefreshData,
  onOpenConfig,
  onSignOutSupabase,
}: TopbarProps) {
  const [openMenu, setOpenMenu] = useState<"user" | "notifications" | null>(null);
  const menusRef = useRef<HTMLDivElement>(null);

  // Fecha menus ao clicar fora ou pressionar Esc
  useEffect(() => {
    if (!openMenu) return;
    const onDown = (event: MouseEvent) => {
      if (!menusRef.current?.contains(event.target as Node)) setOpenMenu(null);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenMenu(null);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [openMenu]);

  const isDark = theme === "dark";

  const connectionLabel =
    dataSourceMode === "supabase"
      ? isSupabaseAuthenticated
        ? "Supabase Online"
        : "Supabase (Login)"
      : dataSourceMode === "local"
        ? "SQLite Local"
        : "Modo Demo";

  const isLiveConnected =
    dataSourceMode === "local" || (dataSourceMode === "supabase" && isSupabaseAuthenticated);

  return (
    <header className="h-[72px] sticky top-0 z-20 border-b border-border bg-background/85 backdrop-blur-md px-4 md:px-8 flex items-center justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onToggleMobileMenu}
          className={cn(ui.iconBtn, "lg:hidden shrink-0")}
          aria-label="Abrir menu de navegação"
        >
          <Menu size={20} />
        </button>


      </div>

      <div ref={menusRef} className="flex items-center gap-2 sm:gap-2.5 min-w-0 ml-auto">
        {/* Indicador de Conexão (SQLite Local / Supabase Online / Demo) */}
        <button
          type="button"
          onClick={onOpenConfig}
          title="Alternar ou configurar fonte de dados"
          className="hidden sm:inline-flex items-center gap-2 h-11 px-3.5 rounded-xl border border-border bg-card hover:border-primary/40 text-xs font-semibold text-foreground transition-colors"
        >
          <span
            className={cn(
              "w-2 h-2 rounded-full",
              isLiveConnected ? "bg-primary animate-pulse" : "bg-muted-foreground"
            )}
          />
          <Database size={14} className="text-brand" />
          <span>{connectionLabel}</span>
        </button>

        {/* Botão de atualizar base quando conectado ao SQLite ou Supabase */}
        {dataSourceMode !== "mock" && onRefreshData && (
          <button
            type="button"
            onClick={onRefreshData}
            disabled={isLoadingData}
            aria-label="Atualizar leads da base ativa"
            title="Sincronizar leads agora"
            className={ui.iconBtn}
          >
            <RefreshCw size={17} className={cn(isLoadingData && "animate-spin text-brand")} />
          </button>
        )}

        {/* Alternância de tema */}
        <button
          onClick={onToggleTheme}
          aria-label={isDark ? "Ativar tema claro" : "Ativar tema escuro"}
          title={isDark ? "Tema claro" : "Tema escuro"}
          className={ui.iconBtn}
        >
          {isDark ? <Sun size={19} /> : <Moon size={19} />}
        </button>

        {/* Notificações */}
        <div className="relative">
          <button
            onClick={() => setOpenMenu(openMenu === "notifications" ? null : "notifications")}
            aria-label="Notificações (1 nova)"
            aria-expanded={openMenu === "notifications"}
            aria-haspopup="true"
            className={cn(ui.iconBtn, "relative")}
          >
            <Bell size={19} />
            <span
              className="absolute top-2.5 right-2.5 w-2 h-2 bg-primary rounded-full ring-2 ring-card"
              aria-hidden="true"
            />
          </button>

          {openMenu === "notifications" && (
            <div
              className={cn(
                ui.menu,
                "absolute right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] p-4 z-50"
              )}
            >
              <div className="flex items-center justify-between pb-3 border-b border-border">
                <span className="font-semibold text-sm text-foreground">Notificações</span>
                <span className="text-xs font-semibold text-brand">Sistema Ativo</span>
              </div>
              <div className="mt-3 p-3 rounded-xl bg-muted text-xs">
                <p className="font-semibold text-foreground">
                  {dataSourceMode === "local"
                    ? "Banco SQLite Local conectado"
                    : dataSourceMode === "supabase"
                      ? "Conexão Supabase public.pharmaleads"
                      : "Ambiente de Demonstração"}
                </p>
                <p className="text-muted-foreground mt-1">
                  {dataSourceMode === "local"
                    ? "API Python local ativa em 127.0.0.1:8765 com Gosom Scraper."
                    : dataSourceMode === "supabase"
                      ? "Sincronizado com public.pharmaleads e GitHub Actions."
                      : "Use Configurações para alternar entre SQLite Local e Supabase."}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Usuário */}
        <div className="relative">
          <button
            onClick={() => setOpenMenu(openMenu === "user" ? null : "user")}
            aria-expanded={openMenu === "user"}
            aria-haspopup="menu"
            aria-label="Menu do usuário Guilherme Ferreira"
            className="flex items-center gap-2.5 h-11 pl-1.5 pr-2 md:pr-3 rounded-xl border border-border bg-card hover:border-primary/40 transition-colors"
          >
            <span className="w-8 h-8 rounded-full bg-primary text-primary-foreground font-bold text-sm flex items-center justify-center">
              G
            </span>
            <span className="hidden md:inline font-semibold text-sm text-foreground">
              Guilherme Ferreira
            </span>
            <ChevronDown
              size={16}
              className={cn(
                "text-muted-foreground transition-transform",
                openMenu === "user" && "rotate-180"
              )}
            />
          </button>

          {openMenu === "user" && (
            <div role="menu" className={cn(ui.menu, "absolute right-0 mt-2 w-60 z-50")}>
              <div className="px-3 py-2.5 border-b border-border mb-1">
                <p className="font-semibold text-sm text-foreground">Guilherme Ferreira</p>
                <p className="text-xs text-muted-foreground">Comercial Centrus</p>
              </div>
              <button
                role="menuitem"
                onClick={() => {
                  setOpenMenu(null);
                  onOpenConfig?.();
                }}
                className={ui.menuItem}
              >
                <User size={16} /> Fonte de Dados ({connectionLabel})
              </button>
              <button
                role="menuitem"
                onClick={() => {
                  setOpenMenu(null);
                  onOpenConfig?.();
                }}
                className={ui.menuItem}
              >
                <ShieldCheck size={16} /> Permissões Supabase
              </button>
              {isSupabaseAuthenticated && onSignOutSupabase && (
                <>
                  <div className="border-t border-border my-1" />
                  <button
                    role="menuitem"
                    onClick={() => {
                      setOpenMenu(null);
                      onSignOutSupabase();
                    }}
                    className={ui.menuItem}
                  >
                    <LogOut size={16} /> Encerrar sessão Supabase
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
```

### apps/web/src/components/prospeccao/ProspeccaoTab.tsx

```tsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Search,
  Play,
  Square,
  MapPin,
  Sliders,
  Globe,
  Mail,
  Zap,
  ExternalLink,
  AlertCircle,
} from "lucide-react";
import { corrigirLocal } from "../../lib/locations";
import { ui } from "../../lib/ui";
import { cn } from "../../lib/utils";
import {
  COLETA_ATIVA_STATES,
  computeUfCoverage,
  controlCloudCollector,
  fetchCloudCollectorRun,
  fetchLocalApiStatus,
  startLocalCollection,
  stopLocalCollection,
  type CollectorRun,
  type DataSourceMode,
  type SupabaseSession,
} from "../../lib/backend";
import type { Status as LocalApiStatus } from "../../lib/crm";
import type { LeadItem } from "../../lib/mock-leads";
import { ProspectSearch } from "./ProspectSearch";

const UFS = [
  "AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO", "MA",
  "MG", "MS", "MT", "PA", "PB", "PE", "PI", "PR", "RJ", "RN",
  "RO", "RR", "RS", "SC", "SE", "SP", "TO",
];
const TERMOS_POR_SEGMENTO: Record<string, number> = {
  varejo: 3,
  manipulacao: 1,
  homeopatia: 1,
  veterinaria: 1,
  distribuidoras: 2,
};

interface ProspeccaoTabProps {
  dataSourceMode?: DataSourceMode;
  supabaseSession?: SupabaseSession | null;
  onSessionUpdate?: (session: SupabaseSession) => void;
  realLeads?: LeadItem[];
  onRefreshLeads?: () => void;
  collectionRequest?: { id: number; local: string } | null;
}

function formatUltimaColeta(valor?: string): string {
  if (!valor) return "Sem coleta";
  const d = new Date(valor);
  return Number.isNaN(d.getTime())
    ? "Sem coleta"
    : d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export function ProspeccaoTab({
  dataSourceMode = "mock",
  supabaseSession = null,
  onSessionUpdate,
  realLeads = [],
  onRefreshLeads,
  collectionRequest = null,
}: ProspeccaoTabProps) {
  const [localDraft, setLocalDraft] = useState("");
  const [localSuggestion, setLocalSuggestion] = useState("");
  const [locais, setLocais] = useState<string[]>([
    "Curitiba, PR",
    "Campinas, SP",
    "Goiânia, GO",
  ]);
  const [coberturaNacional, setCoberturaNacional] = useState(false);
  const [segmentos, setSegmentos] = useState<string[]>(["varejo", "manipulacao"]);
  const [profundidade, setProfundidade] = useState(2);
  const [enriquecerSites, setEnriquecerSites] = useState(false);
  const [buscarEmails, setBuscarEmails] = useState(false);

  // Estado da execução Local (API Python + Gosom)
  const [localStatus, setLocalStatus] = useState<LocalApiStatus | null>(null);
  // Estado da execução Cloud (GitHub Actions /api/collector)
  const [cloudRun, setCloudRun] = useState<CollectorRun | null>(null);
  const refreshedCloudRunRef = useRef<number | null>(null);
  const cloudWasActiveRef = useRef(false);
  const [isBusy, setIsBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [statusMsg, setStatusMsg] = useState("Pronto para iniciar coleta automatizada.");
  const prevLocalTotalRef = useRef<number>(0);
  const handledRequestRef = useRef<number | null>(null);

  // Polling de status para API Local (quando em modo local)
  const pollLocalStatus = useCallback(async () => {
    if (dataSourceMode !== "local") return;
    const status = await fetchLocalApiStatus();
    if (!status) return;
    setLocalStatus(status);
    if (prevLocalTotalRef.current > 0 && status.total_leads !== prevLocalTotalRef.current) {
      onRefreshLeads?.();
    }
    prevLocalTotalRef.current = status.total_leads;

    const run = status.execucao;
    if (run) {
      if (run.estado === "executando") {
        setStatusMsg(
          status.consulta_atual
            ? `Executando Gosom: "${status.consulta_atual}" (${run.concluidas}/${run.total})`
            : `Coleta local em andamento (${run.concluidas}/${run.total} buscas)...`
        );
      } else if (run.estado === "parando") {
        setStatusMsg("Encerrando processo Gosom local...");
      } else if (run.estado === "concluida") {
        setStatusMsg(
          `Última coleta concluída (${run.concluidas}/${run.total} buscas) · ${status.total_leads} leads no SQLite.`
        );
      } else if (run.erro) {
        setStatusMsg(`Execução encerrada (${run.estado}): ${run.erro}`);
      }
    }
  }, [dataSourceMode, onRefreshLeads]);

  // Polling de status para Cloud Collector (quando em modo supabase autenticado)
  const pollCloudStatus = useCallback(async () => {
    if (dataSourceMode !== "supabase" || !supabaseSession) return;
    try {
      const res = await fetchCloudCollectorRun(supabaseSession);
      if (res.session !== supabaseSession) onSessionUpdate?.(res.session);
      setCloudRun(res.run);
      if (res.run) {
        const st = res.run.status;
        if (COLETA_ATIVA_STATES.includes(st)) cloudWasActiveRef.current = true;
        if (st === "completed" && cloudWasActiveRef.current && refreshedCloudRunRef.current !== res.run.id) {
          onRefreshLeads?.();
          refreshedCloudRunRef.current = res.run.id;
          cloudWasActiveRef.current = false;
        }
        if (COLETA_ATIVA_STATES.includes(st)) {
          setStatusMsg(`GitHub Actions em execução: ${res.run.title || st}`);
        } else if (st === "completed") {
          setStatusMsg(
            `Última execução GitHub Actions: ${
              res.run.conclusion === "success"
                ? "Concluída com sucesso"
                : res.run.conclusion === "cancelled"
                  ? "Cancelada"
                  : "Finalizada"
            } (${res.run.title || "cloud-collect"})`
          );
        }
      }
    } catch {
      // Em desenvolvimento local sem GITHUB_ACTIONS_TOKEN na Vercel, mantém silencioso no poll
    }
  }, [dataSourceMode, supabaseSession, onSessionUpdate, onRefreshLeads]);

  useEffect(() => {
    let cancelled = false;
    if (dataSourceMode === "local") {
      queueMicrotask(() => {
        if (!cancelled) void pollLocalStatus();
      });
      const timer = window.setInterval(() => void pollLocalStatus(), 3000);
      return () => {
        cancelled = true;
        window.clearInterval(timer);
      };
    }
    if (dataSourceMode === "supabase" && supabaseSession) {
      queueMicrotask(() => {
        if (!cancelled) void pollCloudStatus();
      });
      const timer = window.setInterval(() => void pollCloudStatus(), 5000);
      return () => {
        cancelled = true;
        window.clearInterval(timer);
      };
    }
    return undefined;
  }, [dataSourceMode, supabaseSession, pollLocalStatus, pollCloudStatus]);

  const isLocalRunning =
    dataSourceMode === "local" &&
    Boolean(
      localStatus?.execucao &&
        (localStatus.execucao.estado === "executando" || localStatus.execucao.estado === "parando")
    );

  const isCloudRunning =
    dataSourceMode === "supabase" &&
    Boolean(
      cloudRun &&
        (COLETA_ATIVA_STATES.includes(cloudRun.status) || cloudRun.status === "cancelling")
    );

  const coletaAtiva = isLocalRunning || isCloudRunning;

  const consultasPorLocal = segmentos.reduce((total, segmento) => total + (TERMOS_POR_SEGMENTO[segmento] || 0), 0);
  const totalConsultas = locais.length * consultasPorLocal;

  // Cálculo de progresso real (zerado quando não há execução registrada)
  const progresso = useMemo(() => {
    if (dataSourceMode === "local" && localStatus?.execucao) {
      return {
        concluidas: localStatus.execucao.concluidas,
        total: Math.max(0, localStatus.execucao.total),
        falhas: localStatus.execucao.falhas,
      };
    }
    if (dataSourceMode === "supabase" && cloudRun) {
      const match = /^Nacional (\d+)\/(\d+)/.exec(cloudRun.title || "");
      if (match) {
        return { concluidas: Number(match[1]), total: Number(match[2]), falhas: 0 };
      }
      return {
        concluidas: cloudRun.status === "completed" ? 1 : 0,
        total: 1,
        falhas: cloudRun.conclusion === "failure" ? 1 : 0,
      };
    }
    return { concluidas: 0, total: 0, falhas: 0 };
  }, [dataSourceMode, localStatus, cloudRun]);

  // Cobertura real por UF (0 quando não há leads reais na UF)
  const realUfMap = useMemo(() => computeUfCoverage(realLeads), [realLeads]);

  const adicionarLocal = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const digitado = localDraft.trim().replace(/\s+/g, " ");
    if (!digitado) return;
    const corrigido = corrigirLocal(digitado);
    if (corrigido !== digitado && !locais.includes(corrigido)) {
      setLocalSuggestion(corrigido);
      return;
    }
    if (!locais.includes(corrigido)) {
      setLocais([...locais, corrigido]);
    }
    setLocalDraft("");
    setLocalSuggestion("");
  };

  const aceitarSugestao = () => {
    if (localSuggestion && !locais.includes(localSuggestion)) {
      setLocais([...locais, localSuggestion]);
    }
    setLocalDraft("");
    setLocalSuggestion("");
  };

  const removerLocal = (localParaRemover: string) => {
    setLocais(locais.filter((l) => l !== localParaRemover));
  };

  const toggleSegmento = (id: string) => {
    setSegmentos((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id]
    );
  };

  const handleStartColeta = async (locaisOverride?: string[]) => {
    setErrorMsg("");
    if (dataSourceMode === "mock") {
      setErrorMsg("A coleta real não está conectada. Entre no Supabase para usar o coletor em nuvem ou inicie a API local com Gosom.");
      return;
    }
    if (dataSourceMode === "supabase" && !supabaseSession) {
      setErrorMsg("Entre com a conta autorizada no Supabase em Configurações para liberar o coletor online.");
      return;
    }
    if (coberturaNacional && dataSourceMode !== "supabase") {
      setErrorMsg("A cobertura nacional está disponível pelo GitHub Actions, com Supabase conectado.");
      return;
    }
    if (dataSourceMode === "local") {
      setIsBusy(true);
      try {
        const res = await startLocalCollection({
          locais: locaisOverride ?? locais,
          segmentos,
          profundidade,
          emails: buscarEmails,
        });
        setStatusMsg(`Execução local #${res.id} iniciada no Gosom Scraper...`);
        await pollLocalStatus();
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : "Falha ao iniciar coleta local.");
      } finally {
        setIsBusy(false);
      }
      return;
    }

    if (dataSourceMode === "supabase" && supabaseSession) {
      setIsBusy(true);
      try {
        if (!coberturaNacional && (locaisOverride ?? locais).length * consultasPorLocal > 20) {
          throw new Error("Esta rodada excede o limite de 20 buscas do coletor online. Reduza locais ou segmentos.");
        }
        const res = await controlCloudCollector(supabaseSession, {
          action: "start",
          ...(coberturaNacional ? { cobertura: "nacional" } : {}),
          locais: (locaisOverride ?? locais).join("\n"),
          segmentos,
          profundidade,
          emails: coberturaNacional ? false : buscarEmails,
          enriquecerSites: coberturaNacional ? false : enriquecerSites,
        });
        if (res.session !== supabaseSession) onSessionUpdate?.(res.session);
        setCloudRun(res.run);
        cloudWasActiveRef.current = true;
        setStatusMsg("Workflow disparado no GitHub Actions. Aguardando execução...");
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : "Falha ao disparar coleta em nuvem.");
      } finally {
        setIsBusy(false);
      }
      return;
    }

  };

  useEffect(() => {
    if (!collectionRequest || handledRequestRef.current === collectionRequest.id) return;
    handledRequestRef.current = collectionRequest.id;
    const localCorrigido = corrigirLocal(collectionRequest.local);
    setLocais([localCorrigido]);
    setCoberturaNacional(false);
    void handleStartColeta([localCorrigido]);
    // Uma solicitação representa uma ação única iniciada pelo modal de Nova Prospecção.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collectionRequest?.id]);

  const handleStopColeta = async () => {
    setErrorMsg("");
    if (dataSourceMode === "local") {
      setIsBusy(true);
      try {
        await stopLocalCollection();
        setStatusMsg("Parada solicitada ao processo Gosom local.");
        await pollLocalStatus();
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : "Falha ao parar coleta local.");
      } finally {
        setIsBusy(false);
      }
      return;
    }

    if (dataSourceMode === "supabase" && supabaseSession) {
      setIsBusy(true);
      try {
        const res = await controlCloudCollector(supabaseSession, { action: "stop" });
        if (res.session !== supabaseSession) onSessionUpdate?.(res.session);
        setCloudRun(res.run);
        setStatusMsg("Cancelamento enviado ao GitHub Actions.");
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : "Falha ao cancelar coleta em nuvem.");
      } finally {
        setIsBusy(false);
      }
      return;
    }

  };

  return (
    <div className="space-y-6 animate-fade-in">
      <ProspectSearch dataSourceMode={dataSourceMode} session={supabaseSession} onSessionUpdate={onSessionUpdate} realLeads={realLeads} />
      <details open={coletaAtiva || Boolean(collectionRequest) ? true : undefined} className={ui.card} onToggle={event => {
        if (event.currentTarget.open) onRefreshLeads?.();
      }}>
        <summary className="px-4 py-5 sm:px-6 cursor-pointer font-bold text-foreground">Coleta no Google Maps · configurar e acompanhar {coletaAtiva ? "(em andamento)" : ""}</summary>
        <div className="p-4 sm:p-6 space-y-6 border-t border-border">
      {/* Cabeçalho da Seção */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className={cn(ui.pageTitle, "flex items-center gap-2.5")}>
            <Search className="text-brand" size={24} />
            <span>Central de Prospecção & Web Scraping</span>
          </h2>
          <p className={ui.pageSubtitle}>
            Configure coletas automatizadas via Google Maps Scraper (Gosom) com enriquecimento via Playwright.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {coletaAtiva ? (
            <button
              onClick={() => void handleStopColeta()}
              disabled={isBusy}
              className={cn(
                ui.btnSecondary,
                "h-12 px-6 text-sm font-bold bg-foreground text-background hover:bg-foreground/90"
              )}
            >
              <Square size={16} /> {isBusy ? "Parando..." : "Parar Coleta"}
            </button>
          ) : (
            <button
              onClick={() => void handleStartColeta()}
              disabled={isBusy || (!coberturaNacional && locais.length === 0) || segmentos.length === 0 || dataSourceMode === "mock" || (dataSourceMode === "supabase" && !supabaseSession) || (coberturaNacional && dataSourceMode !== "supabase") || (!coberturaNacional && dataSourceMode === "supabase" && totalConsultas > 20)}
              className={cn(ui.btnBrand, "h-12 px-8 text-sm")}
            >
              <Play size={17} /> {isBusy ? "Iniciando..." : "Iniciar Coleta"}
            </button>
          )}
        </div>
      </div>

      {errorMsg && (
        <div
          role="alert"
          className="p-4 rounded-2xl bg-surface border border-border flex items-center gap-2.5 text-xs text-foreground font-semibold"
        >
          <AlertCircle size={16} className="text-brand shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Monitor de Execução */}
      <div className={cn(ui.cardInteractive, "p-6")}>
        <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-border gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            <span
              className={cn(
                "w-3 h-3 rounded-full",
                coletaAtiva ? "bg-primary animate-ping" : "bg-muted-foreground"
              )}
            />
            <span className="font-bold text-base text-foreground">Status da Operação</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-primary-soft text-brand font-semibold">
              {coletaAtiva
                ? "Em Execução"
                : dataSourceMode === "local"
                  ? "Motor Local (SQLite + Gosom)"
                  : dataSourceMode === "supabase"
                    ? supabaseSession ? "Motor Cloud (GitHub Actions)" : "Conecte o Supabase"
                    : "Backend não conectado"}
            </span>
            {cloudRun?.url && (
              <a
                href={cloudRun.url}
                target="_blank"
                rel="noreferrer"
                className="text-xs font-semibold text-brand hover:underline inline-flex items-center gap-1"
              >
                Acompanhar no GitHub Actions <ExternalLink size={12} />
              </a>
            )}
          </div>

          <span className="text-xs text-muted-foreground font-mono tabular-nums">
            {progresso.concluidas} de {progresso.total} buscas concluídas · {progresso.falhas} falhas
            {localStatus?.sync_pendente ? ` · ${localStatus.sync_pendente} sync pendente` : ""}
          </span>
        </div>

        <div className="mt-4">
          <div className="w-full bg-muted h-3 rounded-full overflow-hidden border border-border">
            <div
              className="h-full bg-gradient-to-r from-primary to-primary-strong transition-all duration-500 rounded-full"
              style={{
                width: `${
                  progresso.total > 0
                    ? Math.min(100, Math.round((progresso.concluidas / progresso.total) * 100))
                    : 0
                }%`,
              }}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-2 flex items-center gap-2">
            <Zap size={14} className="text-brand shrink-0" />
            <span>
              {dataSourceMode === "mock"
                ? "Modo demonstração: conecte o Supabase ou inicie a API local com Gosom para executar buscas reais."
                : dataSourceMode === "supabase" && !supabaseSession
                  ? "Entre com a conta autorizada no Supabase em Configurações para liberar o coletor online."
                  : statusMsg}
            </span>
          </p>
        </div>
      </div>

      {/* Painel de Configuração da Coleta */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Coluna 1 & 2: Locais e Parâmetros */}
        <div className={cn(ui.card, "lg:col-span-2 p-6 space-y-5")}>
          <div className="flex items-center justify-between pb-3 border-b border-border">
            <h3 className={ui.cardTitle}>
              <MapPin size={18} className="text-brand" /> Locais para Prospecção
            </h3>
            <span className="text-xs text-muted-foreground">
              {dataSourceMode === "supabase" ? "Até 20 buscas por rodada Cloud" : "Busca local enviada ao Gosom"}
            </span>
          </div>

          {/* Campo de Pesquisa de Local */}
          <form onSubmit={adicionarLocal} className="relative flex gap-2">
            <div className="relative flex-1">
              <Search
                size={17}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
              />
              <input
                type="text"
                value={localDraft}
                onChange={(e) => {
                  setLocalDraft(e.target.value);
                  setLocalSuggestion("");
                }}
                placeholder="Ex: Campinas, SP ou Curitiba, PR"
                className={cn(ui.input, "pl-10 rounded-xl")}
              />
            </div>
            <button type="submit" className={cn(ui.btnPrimary, "px-5 h-11 text-xs")}>
              Adicionar
            </button>
          </form>

          {/* Sugestão de Local */}
          {localSuggestion && (
            <div className="p-3 rounded-xl bg-primary-soft border border-primary/25 text-xs text-muted-foreground flex items-center gap-2">
              <span>Você quis dizer</span>
              <button
                type="button"
                onClick={aceitarSugestao}
                className="text-brand font-bold underline cursor-pointer"
              >
                {localSuggestion}
              </button>
              <span>?</span>
            </div>
          )}

          {/* Chips de Locais Adicionados */}
          <div className="flex flex-wrap gap-2 pt-2">
            {locais.map((local) => (
              <span
                key={local}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-primary-soft text-brand border border-primary/25"
              >
                <span>{local}</span>
                <button
                  type="button"
                  onClick={() => removerLocal(local)}
                  className="hover:text-foreground p-0.5"
                  aria-label={`Remover ${local}`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
          {!coberturaNacional && (
            <p className={cn("text-xs", dataSourceMode === "supabase" && totalConsultas > 20 ? "text-destructive" : "text-muted-foreground")}>
              {totalConsultas} {totalConsultas === 1 ? "busca" : "buscas"} nesta execução.
              {dataSourceMode === "supabase" && totalConsultas > 20 ? " Reduza locais ou segmentos para ficar no limite de 20." : ""}
            </p>
          )}

          {/* Opção Cobertura Nacional */}
          <div className="pt-4 border-t border-border">
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={coberturaNacional}
                onChange={(e) => setCoberturaNacional(e.target.checked)}
                disabled={dataSourceMode !== "supabase" || !supabaseSession}
                className={ui.checkbox}
              />
              <div>
                <span className="font-semibold text-sm text-foreground block">
                  Cobertura Nacional Completa
                </span>
                <span className="text-xs text-muted-foreground block">
                  {dataSourceMode === "supabase" && supabaseSession
                    ? "O GitHub Actions percorre a fila nacional em rodadas de até 20 buscas."
                    : "Disponível com Supabase conectado; usa a fila real do GitHub Actions."}
                </span>
              </div>
            </label>
          </div>
        </div>

        {/* Coluna 3: Filtros Avançados & Segmentos */}
        <div className={cn(ui.card, "p-6 space-y-5")}>
          <div className="pb-3 border-b border-border">
            <h3 className={ui.cardTitle}>
              <Sliders size={18} className="text-brand" /> Filtros de Coleta
            </h3>
          </div>

          {/* Segmentos Farmacêuticos */}
          <div className="space-y-2.5">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
              Segmentos Alvo
            </span>
            {[
              { id: "varejo", label: "Farmácia de Varejo / Drogaria" },
              { id: "manipulacao", label: "Farmácia de Manipulação" },
              { id: "homeopatia", label: "Farmácia Homeopática" },
              { id: "veterinaria", label: "Farmácia Veterinária" },
              { id: "distribuidoras", label: "Distribuidoras de Medicamentos" },
            ].map((seg) => (
              <label key={seg.id} className="flex items-center gap-2.5 text-xs text-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={segmentos.includes(seg.id)}
                  onChange={() => toggleSegmento(seg.id)}
                  className={ui.checkbox}
                />
                <span>{seg.label}</span>
              </label>
            ))}
          </div>

          {/* Profundidade */}
          <div className="pt-3 border-t border-border">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-2">
              Profundidade da Busca ({profundidade} páginas)
            </label>
            <input
              type="range"
              min={1}
              max={10}
              value={profundidade}
              onChange={(e) => setProfundidade(Number(e.target.value))}
              className="w-full accent-primary cursor-pointer"
            />
          </div>

          {/* Enriquecimento Playwright */}
          <div className="pt-3 border-t border-border space-y-2">
            <label className="flex items-center gap-2.5 text-xs text-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={enriquecerSites && dataSourceMode === "supabase" && !coberturaNacional}
                onChange={(e) => setEnriquecerSites(e.target.checked)}
                disabled={dataSourceMode !== "supabase" || !supabaseSession || coberturaNacional}
                className={ui.checkbox}
              />
              <span className="flex items-center gap-1.5 font-medium">
                <Globe size={13} className="text-brand" /> Enriquecer Sites (Playwright)
              </span>
            </label>

            <label className="flex items-center gap-2.5 text-xs text-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={buscarEmails && !coberturaNacional}
                onChange={(e) => setBuscarEmails(e.target.checked)}
                disabled={coberturaNacional}
                className={ui.checkbox}
              />
              <span className="flex items-center gap-1.5 font-medium">
                <Mail size={13} className="text-brand" /> Buscar E-mails de Contato
              </span>
            </label>
          </div>
        </div>
      </div>

      {/* Grade de Cobertura por UF */}
      <div className={cn(ui.card, "p-6")} role="region" aria-label="Cobertura por UF">
        <div className="flex items-center justify-between pb-4 border-b border-border mb-4">
          <h3 className="font-bold text-base text-foreground">
            Cobertura Territorial por Estado (27 UFs)
          </h3>
          <span className="text-xs text-brand font-semibold">
            {`${Object.keys(realUfMap).length} de 27 UFs na base ativa`}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-9 gap-2.5">
          {UFS.map((sigla) => {
            const realData = realUfMap[sigla];
            const count = realData?.total || 0;
            const dateLabel = formatUltimaColeta(realData?.ultima);

            return (
              <div
                key={sigla}
                className="p-3 rounded-xl bg-surface border border-border text-center hover:border-primary/50 transition-colors"
              >
                <span className="font-bold text-sm text-foreground block">{sigla}</span>
                <span className="text-[11px] text-brand font-semibold block mt-0.5 tabular-nums">
                  {count === 1 ? "1 lead" : `${count} leads`}
                </span>
                <span className="text-[10px] text-muted-foreground block mt-1 truncate">
                  {dateLabel}
                </span>
              </div>
            );
          })}
        </div>
      </div>
        </div>
      </details>
    </div>
  );
}
```

### apps/web/src/components/prospeccao/ProspectSearch.tsx

```tsx
import { useEffect, useState } from "react";
import { Search, Globe, MapPin, MessageCircle, ChevronLeft, ChevronRight } from "lucide-react";
import type { DataSourceMode, SupabaseSession } from "../../lib/backend";
import type { Lead } from "../../lib/crm";
import type { LeadItem } from "../../lib/mock-leads";
import { ESTABLISHMENTS, STATES, SOURCES, SEARCH_STATUSES, SEARCH_PAGE_SIZE, emptyProspectFilters, prospectTitle, searchSupabaseProspects, type ProspectFilters } from "../../lib/prospect-search";
import { formatNumberBR } from "../../lib/formatters";
import { ui } from "../../lib/ui";
import { cn } from "../../lib/utils";
import { ProspectMultiSelect } from "./ProspectMultiSelect";

type Row = Pick<Lead, "chave" | "nome" | "segmento" | "local_busca" | "telefone" | "telefone_normalizado" | "emails" | "site" | "link" | "whatsapp_link" | "crm_status">;
interface Props {
  dataSourceMode: DataSourceMode;
  session: SupabaseSession | null;
  onSessionUpdate?: (session: SupabaseSession) => void;
  realLeads: LeadItem[];
}
function safeUrl(value: string) {
  if (!value) return undefined;
  try {
    const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    return ["http:", "https:"].includes(url.protocol) ? url.href : undefined;
  } catch { return undefined; }
}

export function ProspectSearch({ dataSourceMode, session, onSessionUpdate, realLeads }: Props) {
  const [draft, setDraft] = useState(emptyProspectFilters);
  const [request, setRequest] = useState({ filters: emptyProspectFilters(), page: 1, revision: 0 });
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      setRows([]);
      setTotal(0);
      try {
        if (dataSourceMode === "supabase" && session) {
          const result = await searchSupabaseProspects(session, request.filters, request.page, controller.signal);
          if (cancelled) return;
          setRows(result.rows);
          setTotal(result.total);
          if (result.session !== session) onSessionUpdate?.(result.session);
        } else if (dataSourceMode === "local") {
          const filters = request.filters;
          const selected = realLeads.filter(lead =>
            (!filters.segments.length || filters.segments.includes(lead.segmento || "")) &&
            (!filters.states.length || filters.states.includes(lead.uf)) &&
            (!filters.sources.length || filters.sources.includes(lead.origem)) &&
            (!filters.statuses.length || filters.statuses.includes(lead.status))
          );
          setTotal(selected.length);
          setRows(selected.slice((request.page - 1) * SEARCH_PAGE_SIZE, request.page * SEARCH_PAGE_SIZE).map(lead => ({
            chave: lead.id, nome: lead.nome, segmento: lead.segmento || "", local_busca: `${lead.cidade}, ${lead.uf}`,
            telefone: lead.telefone, telefone_normalizado: "", emails: lead.email || "", site: lead.site || "",
            link: lead.link || "", whatsapp_link: lead.whatsappLink || "", crm_status: lead.status,
          })));
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Falha na pesquisa.");
      } finally { if (!cancelled) setLoading(false); }
    }
    queueMicrotask(() => { if (!cancelled) void load(); });
    return () => { cancelled = true; controller.abort(); };
  }, [dataSourceMode, session, onSessionUpdate, realLeads, request]);

  const choose = (key: keyof ProspectFilters, values: string[]) => setDraft(current => ({ ...current, [key]: values }));
  const totalPages = Math.max(1, Math.ceil(total / SEARCH_PAGE_SIZE));
  const connected = dataSourceMode === "local" || (dataSourceMode === "supabase" && Boolean(session));
  return (
    <section className="space-y-5" aria-label="Pesquisa de leads">
      <div>
        <h1 className={ui.pageTitle}>Pesquisar estabelecimentos</h1>
        <p className={ui.pageSubtitle}>Encontre contatos na base coletada e refine sua próxima prospecção.</p>
      </div>
      <form className={cn(ui.card, "p-4 sm:p-6")} onSubmit={event => {
        event.preventDefault();
        setRequest(current => ({ filters: draft, page: 1, revision: current.revision + 1 }));
      }}>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <ProspectMultiSelect label="Tipo de estabelecimento" options={ESTABLISHMENTS} values={draft.segments} onChange={values => choose("segments", values)} />
          <ProspectMultiSelect label="Estado" options={STATES} values={draft.states} onChange={values => choose("states", values)} />
          <ProspectMultiSelect label="Fonte dos dados" options={SOURCES} values={draft.sources} onChange={values => choose("sources", values)} />
          <ProspectMultiSelect label="Status do lead" options={SEARCH_STATUSES} values={draft.statuses} onChange={values => choose("statuses", values)} />
        </div>
        <div className="flex flex-wrap items-center gap-3 mt-5">
          <button type="submit" disabled={loading || !connected} className={cn(ui.btnBrand, "h-11 px-7")}><Search size={17} /> {loading ? "Pesquisando..." : "Pesquisar"}</button>
          <button type="button" className={cn(ui.btnSecondary, "h-11 px-4 text-sm")} onClick={() => {
            setDraft(emptyProspectFilters());
            setRequest(current => ({ filters: emptyProspectFilters(), page: 1, revision: current.revision + 1 }));
          }}>Limpar filtros</button>
        </div>
        <p className="mt-4 text-xs text-muted-foreground">A base atual é coletada pelo Google Maps. As demais fontes ainda não têm integração. Estados usam o local da busca registrada; o status Não qualificado ainda não possui registros.</p>
        {!connected && <p role="status" className="mt-3 text-sm text-brand">Entre no Supabase em Configurações para pesquisar os leads armazenados.</p>}
        {dataSourceMode === "local" && <p className="mt-3 text-xs text-muted-foreground">Fonte local: filtros e paginação aplicados aos registros carregados. No Supabase, a pesquisa é paginada no servidor.</p>}
      </form>

      <div className={cn(ui.card, "overflow-hidden")} aria-busy={loading}>
        <div className="p-4 sm:p-6 border-b border-border">
          <h2 className="font-bold text-base text-foreground break-words">{prospectTitle(request.filters)}</h2>
          <p className="text-sm text-muted-foreground mt-1" aria-live="polite">{loading ? "Consultando a base..." : `${formatNumberBR(total)} estabelecimentos encontrados`}</p>
        </div>
        {error ? <div role="alert" className="p-6 text-sm text-foreground">{error} <button type="button" className="text-brand underline ml-2" onClick={() => setRequest(current => ({ ...current, revision: current.revision + 1 }))}>Tentar novamente</button></div> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px] text-left text-sm">
              <caption className="sr-only">Resultados da pesquisa de estabelecimentos farmacêuticos</caption>
              <thead className="bg-surface text-muted-foreground"><tr>{["Farmácia", "Tipo", "Cidade/UF", "Telefone", "E-mail", "Fonte", "Status", "Links"].map(label => <th key={label} scope="col" className="px-4 py-3 text-xs font-semibold">{label}</th>)}</tr></thead>
              <tbody className="divide-y divide-border">
                {loading ? <tr><td colSpan={8} className="p-10 text-center text-muted-foreground" role="status">Carregando leads...</td></tr> : !rows.length ? <tr><td colSpan={8} className="p-10 text-center text-muted-foreground">Nenhum lead encontrado com esses filtros</td></tr> : rows.map(row => {
                  const site = safeUrl(row.site);
                  const maps = safeUrl(row.link);
                  const whatsapp = safeUrl(row.whatsapp_link);
                  return <tr key={row.chave} className="hover:bg-surface/60">
                    <td className="px-4 py-4 font-semibold">{row.nome}</td>
                    <td className="px-4 py-4">{ESTABLISHMENTS.find(option => option.value === row.segmento)?.label || row.segmento || "—"}</td>
                    <td className="px-4 py-4">{row.local_busca || "—"}</td>
                    <td className="px-4 py-4 whitespace-nowrap tabular-nums">{row.telefone || row.telefone_normalizado || "—"}</td>
                    <td className="px-4 py-4 break-words min-w-[190px]">{row.emails || "—"}</td>
                    <td className="px-4 py-4 whitespace-nowrap">Google Maps</td>
                    <td className="px-4 py-4 whitespace-nowrap">{row.crm_status || "Não contatado"}</td>
                    <td className="px-4 py-4"><div className="flex items-center gap-2">
                      {site && <a href={site} target="_blank" rel="noreferrer" aria-label={`Site ou rede social de ${row.nome}`} title={site} className={ui.iconBtn}><Globe size={16} /></a>}
                      {maps && <a href={maps} target="_blank" rel="noreferrer" aria-label={`Google Maps de ${row.nome}`} className={ui.iconBtn}><MapPin size={16} /></a>}
                      {whatsapp && <a href={whatsapp} target="_blank" rel="noreferrer" aria-label={`WhatsApp de ${row.nome}`} className={ui.iconBtn}><MessageCircle size={16} /></a>}
                    </div></td>
                  </tr>;
                })}
              </tbody>
            </table>
          </div>
        )}
        <nav aria-label="Paginação da pesquisa" className="border-t border-border px-4 py-4 flex flex-wrap items-center justify-between gap-3 text-sm">
          <span>Página {request.page} de {totalPages} · até {SEARCH_PAGE_SIZE} resultados por página</span>
          <div className="flex gap-2">
            <button type="button" aria-label="Página anterior da pesquisa" disabled={loading || request.page <= 1} className={cn(ui.btnSecondary, "h-10 px-3")} onClick={() => setRequest(current => ({ ...current, page: current.page - 1 }))}><ChevronLeft size={17} /> Anterior</button>
            <button type="button" aria-label="Próxima página da pesquisa" disabled={loading || request.page >= totalPages || Boolean(error)} className={cn(ui.btnSecondary, "h-10 px-3")} onClick={() => setRequest(current => ({ ...current, page: current.page + 1 }))}>Próxima <ChevronRight size={17} /></button>
          </div>
        </nav>
      </div>
    </section>
  );
}
```

### apps/web/src/components/prospeccao/ProspectMultiSelect.tsx

```tsx
import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { ui } from "../../lib/ui";
import { cn } from "../../lib/utils";

interface Props {
  label: string;
  options: { value: string; label: string }[];
  values: string[];
  onChange: (values: string[]) => void;
}

export function ProspectMultiSelect({ label, options, values, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const root = useRef<HTMLDivElement>(null);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const outside = (event: MouseEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", outside);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("mousedown", outside); document.removeEventListener("keydown", escape); };
  }, [open]);
  const normalized = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const visible = options.filter(option => normalized(option.label).includes(normalized(query)));
  const selected = options.filter(option => values.includes(option.value));
  return (
    <div ref={root} className="relative min-w-0">
      <label id={`${id}-label`} className={cn(ui.label, "block mb-1.5")}>{label}</label>
      <button type="button" aria-labelledby={`${id}-label ${id}-value`} aria-expanded={open} aria-controls={`${id}-options`}
        onClick={() => setOpen(!open)} className={cn(ui.input, "flex items-center justify-between gap-2 text-left")}>
        <span id={`${id}-value`} className="truncate">{selected.length === 1 ? selected[0].label : selected.length ? `${selected.length} selecionados` : "Todos"}</span>
        <ChevronDown size={15} className="shrink-0 text-muted-foreground" />
      </button>
      {open && (
        <div id={`${id}-options`} role="group" aria-label={`Opções de ${label}`} className={cn(ui.menu, "absolute top-full left-0 mt-2 w-full min-w-[220px] max-w-[calc(100vw-3rem)] z-30 p-3")}>
          <input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar" aria-label={`Buscar em ${label}`} className={cn(ui.input, "h-9 mb-2")} />
          <div className="max-h-60 overflow-y-auto space-y-1">
            {visible.map(option => (
              <label key={option.value} className="flex items-start gap-2 rounded-lg p-2 text-xs cursor-pointer hover:bg-muted">
                <input type="checkbox" checked={values.includes(option.value)} className={cn(ui.checkbox, "shrink-0")}
                  onChange={() => onChange(values.includes(option.value) ? values.filter(value => value !== option.value) : [...values, option.value])} />
                {option.label}
              </label>
            ))}
            {!visible.length && <p className="p-2 text-xs text-muted-foreground">Nenhuma opção encontrada.</p>}
          </div>
          <button type="button" onClick={() => { onChange([]); setQuery(""); }} className="text-xs text-brand mt-2">Limpar seleção</button>
        </div>
      )}
    </div>
  );
}
```

### apps/web/src/lib/prospect-search.ts

```typescript
import { PUBLISHABLE_KEY, SUPABASE_URL, validSupabaseSession, type SupabaseSession } from "./backend";
import type { Lead } from "./crm";

export const ESTABLISHMENTS = [
  { value: "varejo", label: "Farmácia de Varejo / Drogaria" },
  { value: "manipulacao", label: "Farmácia de Manipulação" },
  { value: "homeopatia", label: "Farmácia Homeopática" },
  { value: "veterinaria", label: "Farmácia Veterinária" },
  { value: "distribuidoras", label: "Distribuidoras de Medicamentos" },
];
export const STATES = [
  ["AC", "Acre"], ["AL", "Alagoas"], ["AP", "Amapá"], ["AM", "Amazonas"],
  ["BA", "Bahia"], ["CE", "Ceará"], ["DF", "Distrito Federal"], ["ES", "Espírito Santo"],
  ["GO", "Goiás"], ["MA", "Maranhão"], ["MT", "Mato Grosso"], ["MS", "Mato Grosso do Sul"],
  ["MG", "Minas Gerais"], ["PA", "Pará"], ["PB", "Paraíba"], ["PR", "Paraná"],
  ["PE", "Pernambuco"], ["PI", "Piauí"], ["RJ", "Rio de Janeiro"], ["RN", "Rio Grande do Norte"],
  ["RS", "Rio Grande do Sul"], ["RO", "Rondônia"], ["RR", "Roraima"], ["SC", "Santa Catarina"],
  ["SP", "São Paulo"], ["SE", "Sergipe"], ["TO", "Tocantins"],
].map(([value, label]) => ({ value, label: `${label} (${value})` }));
export const SOURCES = ["Google Maps", "Google Meu Negócio", "Receita Federal", "Outras fontes"].map(value => ({ value, label: value }));
export const SEARCH_STATUSES = ["Qualificado", "Em contato", "Respondido", "Não contatado", "Não qualificado"].map(value => ({ value, label: value }));

export interface ProspectFilters {
  segments: string[];
  states: string[];
  sources: string[];
  statuses: string[];
}
export const emptyProspectFilters = (): ProspectFilters => ({ segments: [], states: [], sources: [], statuses: [] });
export const SEARCH_PAGE_SIZE = 25;
const COLUMNS = "chave,nome,segmento,categoria,endereco,local_busca,telefone,telefone_normalizado,emails,site,link,whatsapp_link,crm_status";

function validateSelection(values: string[], options: { value: string }[]) {
  if (values.some(value => !options.some(option => option.value === value))) {
    throw new Error("Filtro de pesquisa inválido.");
  }
}

export function buildProspectQuery(filters: ProspectFilters, page: number): URLSearchParams {
  validateSelection(filters.segments, ESTABLISHMENTS);
  validateSelection(filters.states, STATES);
  validateSelection(filters.sources, SOURCES);
  validateSelection(filters.statuses, SEARCH_STATUSES);
  const query = new URLSearchParams({
    select: COLUMNS,
    order: "nome.asc,chave.asc",
    limit: String(SEARCH_PAGE_SIZE),
    offset: String((Math.max(1, page) - 1) * SEARCH_PAGE_SIZE),
  });
  if (filters.segments.length) query.set("segmento", `in.(${filters.segments.join(",")})`);
  if (filters.states.length) {
    query.set("or", `(${filters.states.map(uf => `local_busca.ilike."*, ${uf}"`).join(",")})`);
  }
  if (filters.statuses.length) query.set("crm_status", `in.(${filters.statuses.map(value => `"${value}"`).join(",")})`);
  // A tabela atual contém somente a coleta Gosom/Maps; não há coluna de fonte.
  if (filters.sources.length && !filters.sources.includes("Google Maps")) query.set("chave", "is.null");
  return query;
}

export async function searchSupabaseProspects(session: SupabaseSession, filters: ProspectFilters, page: number, signal?: AbortSignal) {
  const active = await validSupabaseSession(session);
  const response = await fetch(`${SUPABASE_URL}/rest/v1/pharmaleads?${buildProspectQuery(filters, page)}`, {
    headers: { apikey: PUBLISHABLE_KEY, Authorization: `Bearer ${active.access_token}`, Prefer: "count=exact" },
    signal,
  });
  if (!response.ok) throw new Error(`Não foi possível pesquisar os leads (HTTP ${response.status}). Confira a sessão e as permissões da tabela.`);
  const rows = await response.json() as Lead[];
  const range = response.headers.get("content-range")?.split("/")[1];
  if (!range || range === "*" || !Number.isFinite(Number(range))) throw new Error("O Supabase não informou a contagem de resultados.");
  return { rows, total: Number(range), session: active };
}

export function prospectTitle(filters: ProspectFilters): string {
  const types = filters.segments.map(value => ESTABLISHMENTS.find(option => option.value === value)?.label).join(", ");
  const states = filters.states.map(value => STATES.find(option => option.value === value)?.label).join(", ");
  return `${types || "Estabelecimentos farmacêuticos"} em ${states || "todo o Brasil"}`;
}
```

### apps/web/src/App.test.tsx

```tsx
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { App } from "./App";
import { ProspeccaoTab } from "./components/prospeccao/ProspeccaoTab";
import { SESSION_KEY } from "./lib/backend";

beforeEach(() => { window.localStorage.clear(); window.sessionStorage.clear(); });
afterEach(() => vi.unstubAllGlobals());

test("entrada autenticada consulta uma página sem carregar a base inteira", async () => {
  window.sessionStorage.setItem(SESSION_KEY, JSON.stringify({ access_token: "test", refresh_token: "test", expires_at: Date.now() + 3600000 }));
  const fetcher = vi.fn(async (input: string) => input.includes("/rest/v1/pharmaleads")
    ? new Response("[]", { headers: { "content-range": "*/0" } })
    : new Response(JSON.stringify({ run: null })));
  vi.stubGlobal("fetch", fetcher);
  render(<App />);
  await screen.findByText("0 estabelecimentos encontrados");
  const calls = fetcher.mock.calls.filter(call => call[0].includes("/rest/v1/pharmaleads"));
  expect(calls).toHaveLength(1);
  expect(new URL(calls[0][0]).searchParams.get("limit")).toBe("25");
  expect(fetcher.mock.calls.some(call => call[0].includes("/auth/v1/user"))).toBe(false);
});

test("abre em Prospecção, ordena o menu e mantém o cabeçalho sem pesquisa global", async () => {
  render(<App />);
  expect(screen.getByRole("heading", { name: "Pesquisar estabelecimentos" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Prospecção" })).toHaveAttribute("aria-current", "page");
  const navigation = screen.getByRole("navigation", { name: "Navegação principal" });
  expect([...navigation.querySelectorAll("button")].map(button => button.textContent)).toEqual(["Prospecção", "Leads", "CRM", "Configurações", "Relatórios"]);
  expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Leads" }));
  expect(screen.getByRole("heading", { name: "Leads – Farmácias" })).toBeInTheDocument();
  expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "CRM" }));
  expect(screen.getByText("Pipeline Comercial & Funil CRM")).toBeInTheDocument();
  expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
});

test("coleta recolhível continua enviando a solicitação para a API local", async () => {
  const fetcher = vi.fn(async (input: string) => new Response(JSON.stringify(input === "/api/coletas" ? { id: 1 } : { total_leads: 0, execucao: null, consulta_atual: null })));
  vi.stubGlobal("fetch", fetcher);
  render(<ProspeccaoTab dataSourceMode="local" realLeads={[]} />);
  await userEvent.click(screen.getByText(/Coleta no Google Maps · configurar e acompanhar/));
  await userEvent.click(screen.getByRole("button", { name: "Iniciar Coleta" }));
  await waitFor(() => expect(fetcher.mock.calls.some(call => call[0] === "/api/coletas")).toBe(true));
});
```

### apps/web/src/components/prospeccao/ProspectSearch.test.tsx

```tsx
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { ProspectSearch } from "./ProspectSearch";

afterEach(() => vi.unstubAllGlobals());
test("pesquisa com filtros, muda de página e limpa a consulta sem mascarar contatos", async () => {
  const fetcher = vi.fn(async (input: string) => {
    const offset = new URL(input).searchParams.get("offset") || "0";
    return new Response(JSON.stringify([{ chave: "test", nome: "Registro de verificação", segmento: "manipulacao", local_busca: "São Paulo, SP", telefone: "+5511999991234", emails: "contato@exemplo.com.br", site: "", link: "", whatsapp_link: "", crm_status: "Qualificado" }]), { headers: { "content-range": `${offset}-${offset}/26` } });
  });
  vi.stubGlobal("fetch", fetcher);
  render(<ProspectSearch dataSourceMode="supabase" session={{ access_token: "test", refresh_token: "test", expires_at: Date.now() + 3600000 }} realLeads={[]} />);
  expect(await screen.findByText("contato@exemplo.com.br")).toBeInTheDocument();
  expect(screen.getByText("+5511999991234")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: /Tipo de estabelecimento/ }));
  await userEvent.click(screen.getByRole("checkbox", { name: "Farmácia de Manipulação" }));
  await userEvent.click(screen.getByRole("button", { name: /Tipo de estabelecimento/ }));
  await userEvent.click(screen.getByRole("button", { name: /Estado Todos/ }));
  await userEvent.type(screen.getByRole("searchbox", { name: "Buscar em Estado" }), "sao");
  await userEvent.click(screen.getByRole("checkbox", { name: "São Paulo (SP)" }));
  await userEvent.click(screen.getByRole("button", { name: /Estado São Paulo/ }));
  await userEvent.click(screen.getByRole("button", { name: "Pesquisar" }));
  await waitFor(() => expect(new URL(String(fetcher.mock.calls.at(-1)?.[0])).searchParams.get("segmento")).toBe("in.(manipulacao)"));
  expect(screen.getByRole("heading", { name: "Farmácia de Manipulação em São Paulo (SP)" })).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Próxima página da pesquisa" }));
  await waitFor(() => expect(new URL(String(fetcher.mock.calls.at(-1)?.[0])).searchParams.get("offset")).toBe("25"));
  await userEvent.click(screen.getByRole("button", { name: "Limpar filtros" }));
  await waitFor(() => expect(new URL(String(fetcher.mock.calls.at(-1)?.[0])).searchParams.has("segmento")).toBe(false));
});
```

### apps/web/src/lib/prospect-search.test.tsx

```tsx
import { afterEach, expect, test, vi } from "vitest";
import { buildProspectQuery, emptyProspectFilters, searchSupabaseProspects } from "./prospect-search";

afterEach(() => vi.unstubAllGlobals());

test("filtros vazios consultam todos e a paginação é feita no servidor", () => {
  const query = buildProspectQuery(emptyProspectFilters(), 2);
  expect(query.get("limit")).toBe("25");
  expect(query.get("offset")).toBe("25");
  expect(query.has("segmento")).toBe(false);
  expect(query.has("crm_status")).toBe(false);
  expect(query.has("or")).toBe(false);
});

test("combina grupos por AND e múltiplos valores por OR", () => {
  const query = buildProspectQuery({ segments: ["varejo", "manipulacao"], states: ["SP", "RJ"], sources: ["Google Maps", "Receita Federal"], statuses: ["Qualificado", "Em contato"] }, 1);
  expect(query.get("segmento")).toBe("in.(varejo,manipulacao)");
  expect(query.get("or")).toBe('(local_busca.ilike."*, SP",local_busca.ilike."*, RJ")');
  expect(query.get("crm_status")).toBe('in.("Qualificado","Em contato")');
  expect(query.has("chave")).toBe(false);
});

test("não atribui registros a fontes sem integração nem aceita filtros arbitrários", () => {
  expect(buildProspectQuery({ ...emptyProspectFilters(), sources: ["Receita Federal"] }, 1).get("chave")).toBe("is.null");
  expect(() => buildProspectQuery({ ...emptyProspectFilters(), states: ["XX"] }, 1)).toThrow("Filtro de pesquisa inválido");
});

test("usa autenticação existente, pede contagem exata e preserva contatos completos", async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify([{ chave: "1", telefone: "+55 11 99999-1234", emails: "contato@exemplo.com.br" }]), { headers: { "content-range": "25-25/26" } }));
  vi.stubGlobal("fetch", fetcher);
  const session = { access_token: "jwt-de-teste", refresh_token: "refresh", expires_at: Date.now() + 3600000 };
  const result = await searchSupabaseProspects(session, emptyProspectFilters(), 2);
  expect(result.total).toBe(26);
  expect(result.rows[0].telefone).toBe("+55 11 99999-1234");
  expect(result.rows[0].emails).toBe("contato@exemplo.com.br");
  expect(new URL(fetcher.mock.calls[0][0]).searchParams.get("offset")).toBe("25");
  expect(fetcher.mock.calls[0][1].headers).toMatchObject({ Authorization: "Bearer jwt-de-teste", Prefer: "count=exact" });
});

test("apresenta falha quando a consulta é recusada", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 403 })));
  await expect(searchSupabaseProspects({ access_token: "test", refresh_token: "test", expires_at: Date.now() + 3600000 }, emptyProspectFilters(), 1)).rejects.toThrow("HTTP 403");
});
```

### apps/web/tests/e2e/shell.spec.ts

```typescript
import { expect, test } from "@playwright/test";

test("pesquisa inicial funciona sem overflow e sem erros nos dois temas", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => { if (["error", "warning"].includes(message.type())) errors.push(message.text()); });
  await page.route("**/api/status", route => route.fulfill({ json: { total_leads: 0, execucao: null, consulta_atual: null } }));
  await page.route("**/api/leads**", route => route.fulfill({ json: { items: [], total: 0, next_offset: null } }));
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Pesquisar estabelecimentos" })).toBeVisible();
  await expect(page.getByText("Nenhum lead encontrado com esses filtros")).toBeVisible();
  await expect(page.getByRole("searchbox")).toHaveCount(0);
  for (const width of [360, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    for (const theme of ["light", "dark"]) {
      const toggle = page.getByRole("button", { name: theme === "dark" ? "Ativar tema escuro" : "Ativar tema claro" });
      if (await toggle.count()) await toggle.click();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await page.getByRole("button", { name: /Estado Todos/ }).click();
      await page.getByRole("searchbox", { name: "Buscar em Estado" }).fill("sao");
      await expect(page.getByRole("checkbox", { name: "São Paulo (SP)" })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await page.getByRole("button", { name: /Estado Todos/ }).click();
    }
  }
  await page.screenshot({ path: test.info().outputPath("prospeccao-desktop.png"), fullPage: true });
  expect(errors).toEqual([]);
});
```

## 5. SQL
Nenhuma nova migration ou índice é necessário para esta entrega. A consulta reutiliza crm_status da migration 03_crm_pharmaleads.sql já aplicada. Integração real de novas fontes e adoção de Não qualificado no funil exigem outra definição de escopo/esquema antes de migrações.

## 6. Testar localmente
Na raiz interna do repositório PharmaLeads:

```powershell
npm run dev --prefix apps/web
```
Abra http://127.0.0.1:5173/. Prospecção deve aparecer primeiro. Em Configurações, entre no Supabase para pesquisar a base online. Selecione vários tipos/UFs, pressione Pesquisar e confira título, contagem e navegação. Limpar filtros consulta todos novamente. O Network deve mostrar limit=25 e offset crescente.

Para usar a coleta local, em outro terminal na mesma raiz:

```powershell
python -m pharmaleads.api
```
O Vite encaminha /api para a API Python. A coleta GitHub Actions deve ser conferida no site da Vercel, onde /api/collector é a função correspondente; npm run dev não hospeda essa função serverless.

Verificações do projeto:

```powershell
npm run build --prefix apps/web
npm run lint --prefix apps/web
npm run test --prefix apps/web
npm run test:e2e --prefix apps/web
```

Os testes de navegador verificam 360, 768 e 1280 px em claro/escuro e registram erros/avisos do console. As consultas combinadas também foram aceitas pelo Supabase real em verificação somente de leitura, sem revelar contatos.

## 7. Critérios e limites
- Menu/entrada em Prospecção; cabeçalho sem busca global: implementados.
- Quatro grupos com 5 tipos, 27 UFs, 4 fontes e 5 status: implementados.
- Paginação/contagem no Supabase, contatos completos e estados da consulta: implementados.
- Coletor preservado em seção recolhível; disparo validado com API simulada, sem abrir um job de produção.
- Layout claro/escuro e tamanhos solicitados: verificados no navegador.
- Limites assumidos: outras fontes ainda não integradas, status Não qualificado sem registros, UF obtida de local_busca, redes sociais limitadas aos links efetivamente armazenados.
- Nenhuma alteração de tabela nesta entrega.
