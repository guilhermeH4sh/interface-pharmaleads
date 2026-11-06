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
  onSignOut?: () => void;
  userEmail?: string;
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
  onSignOut,
  userEmail,
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
          title="Ver conexão com o Supabase"
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
            aria-label="Menu do usuário"
            className="flex items-center gap-2.5 h-11 pl-1.5 pr-2 md:pr-3 rounded-xl border border-border bg-card hover:border-primary/40 transition-colors"
          >
            <span className="w-8 h-8 rounded-full bg-primary text-primary-foreground font-bold text-sm flex items-center justify-center">
              {(userEmail || "U")[0].toUpperCase()}
            </span>
            <span className="hidden md:inline font-semibold text-sm text-foreground max-w-[200px] truncate">
              {userEmail || "Minha conta"}
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
                <p className="font-semibold text-sm text-foreground break-all">{userEmail || "Minha conta"}</p>
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
                <User size={16} /> Configurações
              </button>
              <button
                role="menuitem"
                onClick={() => {
                  setOpenMenu(null);
                  onOpenConfig?.();
                }}
                className={ui.menuItem}
              >
                <ShieldCheck size={16} /> Integração de dados
              </button>
              {isSupabaseAuthenticated && onSignOut && (
                <>
                  <div className="border-t border-border my-1" />
                  <button
                    role="menuitem"
                    onClick={() => {
                      setOpenMenu(null);
                      onSignOut();
                    }}
                    className={ui.menuItem}
                  >
                    <LogOut size={16} /> Sair da plataforma
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
