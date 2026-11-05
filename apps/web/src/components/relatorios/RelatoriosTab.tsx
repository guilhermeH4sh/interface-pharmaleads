import { useMemo } from "react";
import { BarChart3, Download, PieChart, TrendingUp, Users, Map } from "lucide-react";
import { formatNumberBR } from "../../lib/formatters";
import { ui } from "../../lib/ui";
import { cn } from "../../lib/utils";
import type { LeadItem, LeadSummary } from "../../lib/mock-leads";

interface RelatoriosTabProps {
  summary: LeadSummary;
  leads?: LeadItem[];
  onExportFullCSV: () => void;
}

export function RelatoriosTab({ summary, leads = [], onExportFullCSV }: RelatoriosTabProps) {
  const analytics = useMemo(() => {
    const total = leads.length;
    if (total === 0) {
      return {
        withPhonePct: "0% com telefone registrado",
        whatsappCount: 0,
        whatsappPct: "0% com WhatsApp identificado",
        segments: [
          { label: "Farmácias de Varejo / Drogarias", pct: 0, count: 0, barClass: "bg-primary" },
          { label: "Farmácias de Manipulação (Magistrais)", pct: 0, count: 0, barClass: "bg-primary-strong" },
          { label: "Homeopatia & Fitoterápicos", pct: 0, count: 0, barClass: "bg-foreground" },
          { label: "Farmácias Veterinárias & Distribuidoras", pct: 0, count: 0, barClass: "bg-muted-foreground" },
        ],
      };
    }

    const withPhoneCount = leads.filter(
      (l) => Boolean(l.telefone && l.telefone !== "Não informado")
    ).length;
    const withPhonePct = `${Math.round((withPhoneCount / total) * 100)}% com telefone registrado`;

    const whatsappCount = leads.filter((l) => Boolean(l.whatsappLink)).length;
    const whatsappPct = `${((whatsappCount / total) * 100).toFixed(1).replace(/\.0$/, "")}% com WhatsApp identificado`;

    let varejo = 0;
    let manipulacao = 0;
    let homeopatia = 0;
    let outros = 0;

    for (const l of leads) {
      const seg = (l.segmento || l.categoria || "").toLowerCase();
      if (seg.includes("manipula")) manipulacao++;
      else if (seg.includes("homeopat")) homeopatia++;
      else if (seg.includes("veterin") || seg.includes("distrib")) outros++;
      else varejo++;
    }

    const pct = (n: number) => Math.round((n / total) * 100);

    return {
      withPhonePct,
      whatsappCount,
      whatsappPct,
      segments: [
        { label: "Farmácias de Varejo / Drogarias", pct: pct(varejo), count: varejo, barClass: "bg-primary" },
        { label: "Farmácias de Manipulação (Magistrais)", pct: pct(manipulacao), count: manipulacao, barClass: "bg-primary-strong" },
        { label: "Homeopatia & Fitoterápicos", pct: pct(homeopatia), count: homeopatia, barClass: "bg-foreground" },
        { label: "Farmácias Veterinárias & Distribuidoras", pct: pct(outros), count: outros, barClass: "bg-muted-foreground" },
      ],
    };
  }, [leads]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className={cn(ui.pageTitle, "flex items-center gap-2.5")}>
            <BarChart3 className="text-brand" size={24} />
            <span>Relatórios Executivos & Inteligência de Mercado</span>
          </h2>
          <p className={ui.pageSubtitle}>
            Métricas analíticas sobre farmácias mapeadas, canais digitais e cobertura geográfica.
          </p>
        </div>

        <button
          onClick={onExportFullCSV}
          className={cn(ui.btnBrand, "h-11 px-6 text-xs shrink-0")}
        >
          <Download size={15} /> Exportar Base Completa (CSV)
        </button>
      </div>

      {/* Grade de Destaques */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className={cn(ui.cardInteractive, "p-6")}>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
              Total de Farmácias
            </span>
            <Users size={18} className="text-brand" />
          </div>
          <div className="text-3xl font-extrabold text-foreground mt-3 tabular-nums">
            {formatNumberBR(summary.totalLeads)}
          </div>
          <p className="text-xs text-brand font-semibold mt-1">{analytics.withPhonePct}</p>
        </div>

        <div className={cn(ui.cardInteractive, "p-6")}>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
              Contatos com WhatsApp
            </span>
            <TrendingUp size={18} className="text-brand" />
          </div>
          <div className="text-3xl font-extrabold text-foreground mt-3 tabular-nums">
            {formatNumberBR(analytics.whatsappCount)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">{analytics.whatsappPct}</p>
        </div>

        <div className={cn(ui.cardInteractive, "p-6")}>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
              Estados Cobertos
            </span>
            <Map size={18} className="text-brand" />
          </div>
          <div className="text-3xl font-extrabold text-foreground mt-3 tabular-nums">
            {summary.estados} / 27
          </div>
          <p className="text-xs text-brand font-semibold mt-1">Capitais + polos do interior</p>
        </div>
      </div>

      {/* Gráficos de Distribuição */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Distribuição por Segmento */}
        <div className={cn(ui.card, "p-6")}>
          <h3 className={cn(ui.cardTitle, "pb-3 border-b border-border")}>
            <PieChart size={18} className="text-brand" /> Distribuição por Segmento Farmacêutico
          </h3>

          <div className="mt-5 space-y-4 text-xs">
            {analytics.segments.map((item) => (
              <div key={item.label} className="space-y-1.5">
                <div className="flex justify-between font-semibold">
                  <span className="text-foreground">{item.label}</span>
                  <span className="text-muted-foreground tabular-nums">
                    {formatNumberBR(item.count)} ({item.pct}%)
                  </span>
                </div>
                <div className="w-full h-2.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn("h-full rounded-full transition-all duration-500", item.barClass)}
                    style={{ width: `${item.pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Distribuição por Canal de Origem */}
        <div className={cn(ui.card, "p-6")}>
          <h3 className={cn(ui.cardTitle, "pb-3 border-b border-border")}>
            <BarChart3 size={18} className="text-brand" /> Origem dos Dados Coletados
          </h3>

          <div className="mt-5 space-y-4 text-xs">
            <div className="space-y-1.5">
              <div className="flex justify-between font-semibold">
                <span className="text-foreground">Google Maps Scraping Direto</span>
                <span className="text-muted-foreground tabular-nums">
                  {formatNumberBR(summary.origem.googleMaps.count)} ({summary.origem.googleMaps.percent}%)
                </span>
              </div>
              <div className="w-full h-2.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full"
                  style={{ width: `${summary.origem.googleMaps.percent}%` }}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between font-semibold">
                <span className="text-foreground">Google Meu Negócio (Perfis Verificados)</span>
                <span className="text-muted-foreground tabular-nums">
                  {formatNumberBR(summary.origem.googleMeuNegocio.count)} ({summary.origem.googleMeuNegocio.percent}%)
                </span>
              </div>
              <div className="w-full h-2.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-[var(--chart-2)] rounded-full"
                  style={{ width: `${summary.origem.googleMeuNegocio.percent}%` }}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between font-semibold">
                <span className="text-foreground">Outras Fontes (Enriquecimento Web & Diretórios)</span>
                <span className="text-muted-foreground tabular-nums">
                  {formatNumberBR(summary.origem.outrasFontes.count)} ({summary.origem.outrasFontes.percent}%)
                </span>
              </div>
              <div className="w-full h-2.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-foreground rounded-full"
                  style={{ width: `${summary.origem.outrasFontes.percent}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
