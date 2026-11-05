import { useId, useState } from "react";
import { Filter, ChevronDown } from "lucide-react";
import { getUFs, getMunicipios, getBairros, type LeadSummary } from "../../lib/mock-leads";
import { formatNumberBR } from "../../lib/formatters";
import { ui } from "../../lib/ui";
import { cn } from "../../lib/utils";

export interface SideFilters {
  uf: string;
  municipio: string;
  bairro: string;
  statusSelect: string;
  origem: string;
}

interface FiltersSidebarProps {
  summary: LeadSummary;
  selectedUF: string;
  selectedMunicipio: string;
  selectedBairro: string;
  selectedStatus: string;
  selectedOrigem: string;
  onApplyFilters: (filters: SideFilters) => void;
  onResetFilters: () => void;
  dynamicLocations?: Record<string, Record<string, string[]>>;
}

const STATUS_ALL = "Todos os status";
const ORIGEM_ALL = "Todas as origens";

function Select({ id, label, value, onChange, disabled, children }: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className={ui.label}>{label}</label>
      <div className="relative">
        <select
          id={id}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className={cn(ui.input, "appearance-none pr-10 cursor-pointer")}
        >
          {children}
        </select>
        <ChevronDown size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" aria-hidden="true" />
      </div>
    </div>
  );
}

export function FiltersSidebar({
  summary,
  selectedUF,
  selectedMunicipio,
  selectedBairro,
  selectedStatus,
  selectedOrigem,
  onApplyFilters,
  onResetFilters,
  dynamicLocations,
}: FiltersSidebarProps) {
  const id = useId();
  const [uf, setUf] = useState(selectedUF);
  const [municipio, setMunicipio] = useState(selectedMunicipio);
  const [bairro, setBairro] = useState(selectedBairro);
  const [status, setStatus] = useState(selectedStatus || STATUS_ALL);
  const [origem, setOrigem] = useState(selectedOrigem || ORIGEM_ALL);

  // Cascata: Município depende da UF; Bairro depende do Município (usa dados reais quando disponíveis)
  const ufsList = dynamicLocations && Object.keys(dynamicLocations).length > 0
    ? Object.keys(dynamicLocations)
    : getUFs();
  const municipios = uf
    ? dynamicLocations && dynamicLocations[uf]
      ? Object.keys(dynamicLocations[uf])
      : getMunicipios(uf)
    : [];
  const bairros = uf && municipio
    ? dynamicLocations && dynamicLocations[uf]?.[municipio]
      ? dynamicLocations[uf][municipio]
      : getBairros(uf, municipio)
    : [];
  const hasFilters = Boolean(uf || municipio || bairro) || status !== STATUS_ALL || origem !== ORIGEM_ALL;

  const reset = () => {
    setUf("");
    setMunicipio("");
    setBairro("");
    setStatus(STATUS_ALL);
    setOrigem(ORIGEM_ALL);
    onResetFilters();
  };

  // Gráfico de rosca em SVG puro
  const radius = 62;
  const circumference = 2 * Math.PI * radius;
  const gap = 4;
  const segments = [
    { label: "Google Maps", pct: summary.origem.googleMaps.percent, color: "var(--chart-1)" },
    { label: "Google Meu Negócio", pct: summary.origem.googleMeuNegocio.percent, color: "var(--chart-2)" },
    { label: "Outras fontes", pct: summary.origem.outrasFontes.percent, color: "var(--chart-3)" },
  ];
  let offset = 0;
  const arcs = segments.map((seg) => {
    const length = (seg.pct / 100) * circumference;
    const arc = { ...seg, dash: Math.max(length - gap, 0), offset: -offset };
    offset += length;
    return arc;
  });

  return (
    <aside className="w-full xl:w-[340px] shrink-0 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-1 gap-6 content-start" aria-label="Filtros e origem dos leads">
      {/* Filtros */}
      <section className={cn(ui.card, "p-6")}>
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-border">
          <h2 className={ui.cardTitle}>
            <Filter size={18} className="text-brand" aria-hidden="true" />
            Filtros
          </h2>
          {hasFilters && (
            <button type="button" onClick={reset} className="text-sm font-medium text-brand hover:underline underline-offset-4">
              Limpar
            </button>
          )}
        </div>

        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            onApplyFilters({ uf, municipio, bairro, statusSelect: status, origem });
          }}
        >
          <Select id={`${id}-uf`} label="UF" value={uf} onChange={(v) => { setUf(v); setMunicipio(""); setBairro(""); }}>
            <option value="">Selecionar UF(s)</option>
            {ufsList.map((item) => <option key={item} value={item}>{item}</option>)}
          </Select>

          <Select id={`${id}-mun`} label="Município" value={municipio} disabled={!uf} onChange={(v) => { setMunicipio(v); setBairro(""); }}>
            <option value="">{uf ? "Selecionar município" : "Selecione uma UF primeiro"}</option>
            {municipios.map((item) => <option key={item} value={item}>{item}</option>)}
          </Select>

          <Select id={`${id}-bairro`} label="Bairro" value={bairro} disabled={!municipio} onChange={setBairro}>
            <option value="">{municipio ? "Selecionar bairro" : "Selecione um município primeiro"}</option>
            {bairros.map((item) => <option key={item} value={item}>{item}</option>)}
          </Select>

          <Select id={`${id}-status`} label="Status" value={status} onChange={setStatus}>
            <option value={STATUS_ALL}>{STATUS_ALL}</option>
            <option value="Qualificado">Qualificado</option>
            <option value="Em contato">Em contato</option>
            <option value="Respondido">Respondido</option>
            <option value="Não contatado">Não contatado</option>
          </Select>

          <Select id={`${id}-origem`} label="Origem" value={origem} onChange={setOrigem}>
            <option value={ORIGEM_ALL}>{ORIGEM_ALL}</option>
            <option value="Google Maps">Google Maps</option>
            <option value="Google Meu Negócio">Google Meu Negócio</option>
            <option value="Outras fontes">Outras fontes</option>
          </Select>

          <button type="submit" className={cn(ui.btnBrand, "h-12 mt-2 text-sm")}>
            <Filter size={16} aria-hidden="true" />
            Aplicar Filtros
          </button>
        </form>
      </section>

      {/* Origem dos Leads */}
      <section className={cn(ui.card, "p-6")}>
        <h2 className={cn(ui.cardTitle, "pb-4 mb-2 border-b border-border")}>Origem dos Leads</h2>

        <div className="flex items-center justify-center py-4">
          <div className="relative w-[160px] h-[160px]">
            <svg viewBox="0 0 160 160" className="w-full h-full -rotate-90" role="img" aria-label="Distribuição da origem dos leads">
              <circle cx="80" cy="80" r={radius} fill="none" stroke="var(--chart-track)" strokeWidth="18" />
              {arcs.map((arc) => (
                <circle
                  key={arc.label}
                  cx="80"
                  cy="80"
                  r={radius}
                  fill="none"
                  stroke={arc.color}
                  strokeWidth="18"
                  strokeDasharray={`${arc.dash} ${circumference}`}
                  strokeDashoffset={arc.offset}
                />
              ))}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-xl font-extrabold tracking-tight text-foreground tabular-nums">{formatNumberBR(summary.totalLeads)}</span>
              <span className="text-xs text-muted-foreground">Leads</span>
            </div>
          </div>
        </div>

        <ul className="flex flex-col gap-3 text-sm">
          {segments.map((seg) => (
            <li key={seg.label} className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2.5 text-muted-foreground">
                <span className="w-2.5 h-2.5 rounded-full ring-1 ring-border" style={{ background: seg.color }} aria-hidden="true" />
                {seg.label}
              </span>
              <span className="font-semibold text-foreground tabular-nums">{seg.pct}%</span>
            </li>
          ))}
        </ul>
      </section>
    </aside>
  );
}
