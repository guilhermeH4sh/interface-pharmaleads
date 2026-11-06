import { Settings, Database, Check } from "lucide-react";
import { ui } from "../../lib/ui";
import { cn } from "../../lib/utils";

export function ConfigTab({ supabaseLeadsCount = null }: { supabaseLeadsCount?: number | null }) {
  return (
    <div className="space-y-6 max-w-4xl">
      <h2 className={cn(ui.pageTitle, "flex items-center gap-2.5")}><Settings size={24} className="text-brand" />Configurações</h2>
      <section className={cn(ui.card, "p-6")}>
        <div className="flex items-center justify-between gap-4">
          <h3 className={ui.cardTitle}><Database size={18} className="text-brand" />Supabase</h3>
          <span role="status" className="text-sm font-semibold flex items-center gap-2"><Check size={16} className="text-brand" />Conectado</span>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">Integração fixa da plataforma, gerenciada automaticamente. Não é necessário conectar o banco manualmente.</p>
        {supabaseLeadsCount != null && <p className="mt-2 text-sm text-muted-foreground">{supabaseLeadsCount.toLocaleString("pt-BR")} leads na base.</p>}
      </section>
    </div>
  );
}
