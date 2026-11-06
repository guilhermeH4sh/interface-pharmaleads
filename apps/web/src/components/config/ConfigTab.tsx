import { useState, type FormEvent } from "react";
import { Settings, Database, Check, LogIn, AlertCircle } from "lucide-react";
import { ui } from "../../lib/ui";
import { cn } from "../../lib/utils";
import { type SupabaseSession } from "../../lib/backend";

interface ConfigTabProps {
  supabaseSession?: SupabaseSession | null;
  onSignInSupabase?: (email: string, password: string) => Promise<void>;
  supabaseLeadsCount?: number | null;
}

export function ConfigTab({ supabaseSession = null, onSignInSupabase, supabaseLeadsCount = null }: ConfigTabProps) {
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
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : "Falha na autenticação com o Supabase.");
    } finally {
      setAuthLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <h2 className={cn(ui.pageTitle, "flex items-center gap-2.5")}><Settings size={24} className="text-brand" />Configurações</h2>
      <section className={cn(ui.card, "p-6")}>
        <div className="flex items-center justify-between gap-4">
          <h3 className={ui.cardTitle}><Database size={18} className="text-brand" />Supabase</h3>
          <span role="status" className="text-sm font-semibold flex items-center gap-2">
            {supabaseSession && <Check size={16} className="text-brand" />}
            {supabaseSession ? "Conectado" : "Reconexão necessária"}
          </span>
        </div>
        {supabaseSession ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Sua conexão é mantida automaticamente neste navegador.
            {supabaseLeadsCount != null && ` ${supabaseLeadsCount.toLocaleString("pt-BR")} leads disponíveis.`}
          </p>
        ) : (
          <form onSubmit={event => void handleSupabaseLogin(event)} className="mt-4 space-y-4">
            <p className="text-sm text-muted-foreground">Conecte uma vez neste navegador. A sessão será mantida para os próximos acessos.</p>
            {authError && <p role="alert" className="flex items-center gap-2 text-sm"><AlertCircle size={16} />{authError}</p>}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className={ui.label}>E-mail<input type="email" autoComplete="username" required value={email} onChange={event => setEmail(event.target.value)} className={ui.input} /></label>
              <label className={ui.label}>Senha<input type="password" autoComplete="current-password" required value={password} onChange={event => setPassword(event.target.value)} className={ui.input} /></label>
            </div>
            <button type="submit" disabled={authLoading} className={cn(ui.btnBrand, "h-11 px-6")}><LogIn size={16} />{authLoading ? "Conectando..." : "Conectar Supabase"}</button>
          </form>
        )}
      </section>
    </div>
  );
}
