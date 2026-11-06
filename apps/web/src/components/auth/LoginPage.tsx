import { useState, type FormEvent } from "react";
import { ArrowRight, LockKeyhole } from "lucide-react";
import { ui } from "../../lib/ui";
import { cn } from "../../lib/utils";

interface Props { onSignIn: (email: string, password: string) => Promise<void>; message?: string; }

export function LoginPage({ onSignIn, message = "" }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError("");
    try { await onSignIn(email.trim(), password); setPassword(""); }
    catch (cause) { setPassword(""); setError(cause instanceof Error ? cause.message : "Não foi possível entrar. Tente novamente."); }
    finally { setBusy(false); }
  }
  return (
    <main className="min-h-dvh bg-background text-foreground flex items-center justify-center p-4 sm:p-8">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-3 mb-8">
          <img src="/brand/centrus-logo-96.png" alt="" width={48} height={48} className="rounded-full" />
          <span className="text-2xl font-extrabold">Pharma<span className="text-brand">Leads</span></span>
        </div>
        <section className={cn(ui.card, "p-6 sm:p-8")}>
          <LockKeyhole size={24} className="text-brand mb-4" />
          <h1 className={ui.pageTitle}>Acesse sua plataforma</h1>
          <p className="text-sm text-muted-foreground mt-3 mb-6">Entre para prospectar e gerenciar seus leads.</p>
          <form onSubmit={event => void submit(event)} className="space-y-5">
            {(error || message) && <p role="alert" className="text-sm text-foreground rounded-lg border border-border p-3">{error || message}</p>}
            <div><label htmlFor="platform-email" className={ui.label}>E-mail</label><input id="platform-email" type="email" autoComplete="username" required value={email} onChange={event => setEmail(event.target.value)} disabled={busy} className={cn(ui.input, "mt-1.5 w-full")} /></div>
            <div><label htmlFor="platform-password" className={ui.label}>Senha</label><input id="platform-password" type="password" autoComplete="current-password" required value={password} onChange={event => setPassword(event.target.value)} disabled={busy} className={cn(ui.input, "mt-1.5 w-full")} /></div>
            <button type="submit" disabled={busy} className={cn(ui.btnBrand, "w-full h-12")}>{busy ? "Entrando..." : "Entrar"}<ArrowRight size={17} /></button>
          </form>
        </section>
        <p className="text-center text-xs text-muted-foreground mt-6">Centrus AI · Inteligência Farmacêutica</p>
      </div>
    </main>
  );
}
