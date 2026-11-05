import { useState, type FormEvent } from "react";
import {
  Settings,
  Database,
  Check,
  HardDrive,
  Cloud,
  LogIn,
  LogOut,
  AlertCircle,
} from "lucide-react";
import { ui } from "../../lib/ui";
import { cn } from "../../lib/utils";
import { type DataSourceMode, type SupabaseSession } from "../../lib/backend";

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
  // Estados do formulário de Login Supabase Auth
  const [email, setEmail] = useState(supabaseSession?.email || "");
  const [password, setPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");

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
          Escolha a fonte de dados, conecte o Supabase e veja como os motores de coleta são executados.
        </p>
      </div>

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
                Interface sem estabelecimentos de demonstração. Conecte uma fonte real para ver leads.
              </p>
            </div>
            <span className="mt-3 inline-block text-[11px] font-semibold text-muted-foreground">
              Nenhum lead fictício
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

      <div className={cn(ui.card, "p-6 space-y-3")}>
        <h3 className={cn(ui.cardTitle, "pb-3 border-b border-border")}>
          <Settings size={18} className="text-brand" /> Como a coleta é executada
        </h3>
        <p className="text-xs text-muted-foreground">
          As credenciais e parâmetros do motor são definidos no ambiente do serviço. Esta tela não altera chaves nem concorrência.
        </p>
        <ul className="space-y-2 text-xs text-muted-foreground">
          <li><strong className="text-foreground">Local:</strong> API Python, Gosom em <code className="text-brand">bin/google-maps-scraper</code> e banco SQLite.</li>
          <li><strong className="text-foreground">Nuvem:</strong> endpoint <code className="text-brand">/api/collector</code> valida a sessão Supabase e dispara o workflow <code className="text-brand">cloud-collect.yml</code> no GitHub Actions.</li>
          <li><strong className="text-foreground">Limites:</strong> buscas avulsas na nuvem aceitam até 20 consultas por rodada; profundidade e enriquecimento são escolhidos na Central de Prospecção.</li>
        </ul>
      </div>
    </div>
  );
}
