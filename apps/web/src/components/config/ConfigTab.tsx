import { useState } from "react";
import { Settings, Database, Check, TableProperties, Search, MailCheck } from "lucide-react";
import { ui } from "../../lib/ui";
import { cn } from "../../lib/utils";
import { getPreferences, savePreferences } from "../../lib/preferences";

export function ConfigTab() {
  const [pageSize, setPageSize] = useState(() => getPreferences().pageSize);
  function changePageSize(value: string) {
    const size = Number(value);
    if (size === 5 || size === 10 || size === 25 || size === 50) {
      setPageSize(size); savePreferences({ pageSize: size });
    }
  }
  return (
    <div className="max-w-4xl space-y-6">
      <h2 className={cn(ui.pageTitle, "flex items-center gap-2.5")}><Settings size={24} className="text-brand" />Configurações</h2>
      <section className={cn(ui.card, "p-6 space-y-5")}>
        <h3 className={ui.cardTitle}><TableProperties size={18} className="text-brand" />Preferências da interface</h3>
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border pt-4">
          <div><p className="font-medium">Leads por página</p><p className="text-sm text-muted-foreground">Ajuste quantos registros aparecem na tabela.</p></div>
          <select aria-label="Leads por página" className={cn(ui.input,"w-32")} value={pageSize} onChange={e => changePageSize(e.target.value)}>
            {[5,10,25,50].map(n => <option key={n} value={n}>{n} por página</option>)}
          </select>
        </div>
      </section>
      <section className={cn(ui.card, "p-6 space-y-4")}>
        <h3 className={ui.cardTitle}><Search size={18} className="text-brand" />Coleta de leads</h3>
        <div className="flex items-start gap-3 border-t border-border pt-4"><MailCheck size={18} className="mt-0.5 text-brand"/><div><p className="font-medium">E-mail público obrigatório</p><p className="text-sm text-muted-foreground">Novos leads só entram no Supabase quando a coleta encontra e valida um e-mail público.</p></div></div>
        <div className="flex items-start gap-3"><Database size={18} className="mt-0.5 text-brand"/><div><p className="font-medium">Google Maps</p><p className="text-sm text-muted-foreground">Fonte de descoberta usada pela coleta. Ajustes de concorrência e credenciais são controlados pelo serviço, não pelo navegador.</p></div></div>
      </section>
      <section className={cn(ui.card, "p-6")}>
        <div className="flex items-center justify-between gap-4"><h3 className={ui.cardTitle}><Database size={18} className="text-brand"/>Conexão do banco</h3><span role="status" className="flex items-center gap-2 text-sm font-semibold"><Check size={16} className="text-brand"/>Supabase conectado</span></div>
        <p className="mt-3 text-sm text-muted-foreground">A conexão da plataforma é gerenciada automaticamente. Não é necessário reconectar o banco.</p>
      </section>
    </div>
  );
}
