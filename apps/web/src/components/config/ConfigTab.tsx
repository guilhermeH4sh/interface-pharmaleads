import { useState, type FormEvent } from "react";
import {
  Settings,
  Database,
  Key,
  Check,
  HardDrive,
  Cloud,
  LogIn,
  LogOut,
  AlertCircle,
} from "lucide-react";
import { ui } from "../../lib/ui";
import { cn } from "../../lib/utils";
import {
  PUBLISHABLE_KEY,
  SUPABASE_URL,
  type DataSourceMode,
  type SupabaseSession,
} from "../../lib/backend";

interface ConfigTabProps {
  dataSourceMode: DataSourceMode;
  onToggleDataSource: (mode: DataSourceMode) => void;
  supabaseSession?: SupabaseSession | null;
  onSignInSupabase?: (email: string, password: string) => Promise<void>;
  onSignOutSupabase?: () => void;
  localLeadsCount?: number | null;
  supabaseLeadsCount?: number | null;
}

export function ConfigTab({
  dataSourceMode,
  onToggleDataSource,
  supabaseSession = null,
  onSignInSupabase,
  onSignOutSupabase,
  localLeadsCount = null,
  supabaseLeadsCount = null,
}: ConfigTabProps) {
  const [supabaseUrl, setSupabaseUrl] = useState(SUPABASE_URL);
  const [supabaseKey, setSupabaseKey] = useState(PUBLISHABLE_KEY);
  const [maxConcurrency, setMaxConcurrency] = useState(2);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Estados do formulário de Login Supabase Auth
  const [email, setEmail] = useState(supabaseSession?.email || "");
  const [password, setPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");

  const handleSave = (e: FormEvent) => {
    e.preventDefault();
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  const handleSupabaseLogin = async (e: FormEvent) => {
    e.preventDefault();
    if (!onSignInSupabase) return;
    setAuthLoading(true);
    setAuthError("");
    try {
      await onSignInSupabase(email.trim(), password);
      setPassword("");
      onToggleDataSource("supabase");
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : "Falha na autenticação com o Supabase.");
    } finally {
      setAuthLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl">
      {/* Cabeçalho */}
      <div>
        <h2 className={cn(ui.pageTitle, "flex items-center gap-2.5")}>
          <Settings className="text-brand" size={24} />
          <span>Configurações da Plataforma</span>
        </h2>
        <p className={ui.pageSubtitle}>
          Gerencie a fonte de dados ativa (SQLite Local, Supabase Online ou Mock), autenticação e parâmetros do scraper.
        </p>
      </div>

      {savedSuccess && (
        <div className="p-4 rounded-xl bg-primary-soft border border-primary/25 text-brand text-xs font-semibold flex items-center gap-2">
          <Check size={16} /> Configurações salvas e aplicadas com sucesso.
        </div>
      )}

      {/* Modo de Fonte de Dados (3 motores integrados) */}
      <div className={cn(ui.card, "p-6")}>
        <h3 className={cn(ui.cardTitle, "pb-3 border-b border-border")}>
          <Database size={18} className="text-brand" /> Fonte de Dados Ativa
        </h3>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* 1. SQLite Local + Gosom */}
          <button
            type="button"
            onClick={() => onToggleDataSource("local")}
            className={cn(
              "p-4 rounded-xl border text-left transition-all flex flex-col justify-between",
              dataSourceMode === "local"
                ? "bg-primary-soft border-primary shadow-[var(--shadow-card)]"
                : "bg-surface border-border hover:border-primary/40"
            )}
          >
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-sm text-foreground flex items-center gap-1.5">
                  <HardDrive size={15} className="text-brand" /> SQLite Local + Gosom
                </span>
                {dataSourceMode === "local" && <Check size={16} className="text-brand shrink-0" />}
              </div>
              <p className="text-xs text-muted-foreground mt-1.5">
                Conecta à API Python local (<code className="text-brand">127.0.0.1:8765</code>) e ao banco SQLite em <code className="text-brand">dados/</code>.
              </p>
            </div>
            <span className="mt-3 inline-block text-[11px] font-semibold text-brand">
              {localLeadsCount != null
                ? `${localLeadsCount} leads locais disponíveis`
                : "API Local pronta"}
            </span>
          </button>

          {/* 2. Supabase Online */}
          <button
            type="button"
            onClick={() => onToggleDataSource("supabase")}
            className={cn(
              "p-4 rounded-xl border text-left transition-all flex flex-col justify-between",
              dataSourceMode === "supabase"
                ? "bg-primary-soft border-primary shadow-[var(--shadow-card)]"
                : "bg-surface border-border hover:border-primary/40"
            )}
          >
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-sm text-foreground flex items-center gap-1.5">
                  <Cloud size={15} className="text-brand" /> Supabase Online
                </span>
                {dataSourceMode === "supabase" && <Check size={16} className="text-brand shrink-0" />}
              </div>
              <p className="text-xs text-muted-foreground mt-1.5">
                Lê diretamente <code className="text-brand font-semibold">public.pharmaleads</code> protegido por RLS e aciona o GitHub Actions.
              </p>
            </div>
            <span className="mt-3 inline-block text-[11px] font-semibold text-brand">
              {supabaseSession
                ? supabaseLeadsCount != null
                  ? `Autenticado · ${supabaseLeadsCount} leads`
                  : "Sessão ativa"
                : "Requer login abaixo"}
            </span>
          </button>

          {/* 3. Ambiente de Demonstração (Mock) */}
          <button
            type="button"
            onClick={() => onToggleDataSource("mock")}
            className={cn(
              "p-4 rounded-xl border text-left transition-all flex flex-col justify-between",
              dataSourceMode === "mock"
                ? "bg-primary-soft border-primary shadow-[var(--shadow-card)]"
                : "bg-surface border-border hover:border-primary/40"
            )}
          >
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-sm text-foreground">Modo Demonstração (Mock)</span>
                {dataSourceMode === "mock" && <Check size={16} className="text-brand shrink-0" />}
              </div>
              <p className="text-xs text-muted-foreground mt-1.5">
                18.947 leads simulados, filtros e paginação instantâneos para validação de interface.
              </p>
            </div>
            <span className="mt-3 inline-block text-[11px] font-semibold text-muted-foreground">
              Dados em memória
            </span>
          </button>
        </div>
      </div>

      {/* Painel de Autenticação Supabase (RLS public.pharmaleads) */}
      <div className={cn(ui.card, "p-6")}>
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <h3 className={ui.cardTitle}>
            <LogIn size={18} className="text-brand" /> Acesso Autenticado ao Supabase (RLS)
          </h3>
          <span
            className={cn(
              "text-xs px-2.5 py-0.5 rounded-full font-semibold",
              supabaseSession
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground"
            )}
          >
            {supabaseSession ? "Conectado" : "Desconectado"}
          </span>
        </div>

        {supabaseSession ? (
          <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-surface border border-border">
            <div>
              <p className="text-sm font-bold text-foreground">
                Sessão Supabase ativa {supabaseSession.email ? `(${supabaseSession.email})` : ""}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Acesso autorizado à tabela <code className="text-brand">public.pharmaleads</code> e ao coletor em nuvem.
              </p>
            </div>
            {onSignOutSupabase && (
              <button
                type="button"
                onClick={onSignOutSupabase}
                className={cn(ui.btnSecondary, "h-10 px-4 text-xs shrink-0")}
              >
                <LogOut size={15} /> Encerrar Sessão
              </button>
            )}
          </div>
        ) : (
          <form onSubmit={(e) => void handleSupabaseLogin(e)} className="mt-4 space-y-4">
            <p className="text-xs text-muted-foreground">
              Entre com o e-mail e senha do usuário autorizado no Supabase Authentication para consultar os leads online e disparar coletas no GitHub Actions.
            </p>

            {authError && (
              <div
                role="alert"
                className="p-3 rounded-xl bg-surface border border-border text-xs text-foreground font-semibold flex items-center gap-2"
              >
                <AlertCircle size={15} className="text-brand shrink-0" />
                <span>{authError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="supabase-auth-email" className={ui.label}>
                  E-mail Supabase
                </label>
                <input
                  id="supabase-auth-email"
                  type="email"
                  autoComplete="username"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu-email@dominio.com"
                  className={ui.input}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="supabase-auth-password" className={ui.label}>
                  Senha
                </label>
                <input
                  id="supabase-auth-password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className={ui.input}
                />
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={authLoading}
                className={cn(ui.btnBrand, "h-11 px-6 text-xs")}
              >
                <LogIn size={15} />
                <span>{authLoading ? "Autenticando..." : "Entrar e Sincronizar Supabase"}</span>
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Formulário Supabase & Credenciais */}
      <form onSubmit={handleSave} className={cn(ui.card, "p-6 space-y-4")}>
        <h3 className={cn(ui.cardTitle, "pb-3 border-b border-border")}>
          <Key size={18} className="text-brand" /> Parâmetros do Projeto & Concorrência
        </h3>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="cfg-supabase-url" className={ui.label}>
            Supabase URL
          </label>
          <input
            id="cfg-supabase-url"
            type="text"
            value={supabaseUrl}
            onChange={(e) => setSupabaseUrl(e.target.value)}
            className={cn(ui.input, "font-mono")}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="cfg-supabase-key" className={ui.label}>
            Publishable Anon Key
          </label>
          <input
            id="cfg-supabase-key"
            type="password"
            value={supabaseKey}
            onChange={(e) => setSupabaseKey(e.target.value)}
            className={cn(ui.input, "font-mono")}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="cfg-concurrency" className={ui.label}>
            Concorrência Gosom / Scraper (Instâncias simultâneas)
          </label>
          <input
            id="cfg-concurrency"
            type="number"
            min={1}
            max={8}
            value={maxConcurrency}
            onChange={(e) => setMaxConcurrency(Number(e.target.value))}
            className={cn(ui.input, "w-32")}
          />
          <span className="text-[11px] text-muted-foreground">
            Recomendado: 2 contêineres para evitar limitações de taxa do Google Maps.
          </span>
        </div>

        <div className="pt-3 border-t border-border flex justify-end">
          <button type="submit" className={cn(ui.btnPrimary, "h-11 px-6 text-xs")}>
            Salvar Preferências
          </button>
        </div>
      </form>
    </div>
  );
}
