import { useId, useState, type ReactNode } from "react";
import { Filter, ChevronDown } from "lucide-react";
import { getUFs, getMunicipios, getBairros } from "../../lib/mock-leads";
import { ui } from "../../lib/ui";
import { cn } from "../../lib/utils";
import type { EmailAvailability } from "../../lib/email";
import type { LeadStatus } from "../../lib/mock-leads";
import { ESTABLISHMENTS } from "../../lib/prospect-options";
import { ProspectMultiSelect } from "../prospeccao/ProspectMultiSelect";

export interface SideFilters {
  uf: string;
  municipio: string;
  bairro: string;
  statusSelect: string;
  origem: string;
  segmentos: string[];
  emailAvailability: EmailAvailability;
}

interface FiltersSidebarProps {
  selectedUF: string;
  selectedMunicipio: string;
  selectedBairro: string;
  selectedStatus: string;
  selectedOrigem: string;
  selectedSegmentos: string[];
  selectedEmailAvailability: EmailAvailability;
  onApplyFilters: (filters: SideFilters) => void;
  onResetFilters: () => void;
  dynamicLocations?: Record<string, Record<string, string[]>>;
  availableOrigins?: string[];
  statusOptions?: LeadStatus[];
  showStatusFilter?: boolean;
}

const STATUS_ALL = "Todos os status";
const ORIGEM_ALL = "Todas as origens";

function Select({ id, label, value, onChange, disabled, children }: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={id} className={ui.label}>{label}</label>
      <div className="relative">
        <select
          id={id}
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          className={cn(ui.input, "h-10 appearance-none pr-10 cursor-pointer")}
        >
          {children}
        </select>
        <ChevronDown size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" aria-hidden="true" />
      </div>
    </div>
  );
}

export function FiltersSidebar({
  selectedUF,
  selectedMunicipio,
  selectedBairro,
  selectedStatus,
  selectedOrigem,
  selectedSegmentos,
  selectedEmailAvailability,
  onApplyFilters,
  onResetFilters,
  dynamicLocations,
  availableOrigins,
  statusOptions = ["Qualificado", "Não qualificado", "Em contato", "Respondido", "Não contatado"],
  showStatusFilter = true,
}: FiltersSidebarProps) {
  const id = useId();
  const [uf, setUf] = useState(selectedUF);
  const [municipio, setMunicipio] = useState(selectedMunicipio);
  const [bairro, setBairro] = useState(selectedBairro);
  const [status, setStatus] = useState(selectedStatus || STATUS_ALL);
  const [origem, setOrigem] = useState(selectedOrigem || ORIGEM_ALL);
  const [segmentos, setSegmentos] = useState(selectedSegmentos);
  const [emailAvailability, setEmailAvailability] = useState<EmailAvailability>(selectedEmailAvailability);

  const ufsList = dynamicLocations !== undefined ? Object.keys(dynamicLocations).sort() : getUFs();
  const municipios = uf
    ? dynamicLocations !== undefined
      ? Object.keys(dynamicLocations[uf] || {}).sort()
      : getMunicipios(uf)
    : [];
  const bairros = uf && municipio
    ? dynamicLocations !== undefined
      ? dynamicLocations[uf]?.[municipio] || []
      : getBairros(uf, municipio)
    : [];
  const hasFilters = Boolean(uf || municipio || bairro || segmentos.length) || (showStatusFilter && status !== STATUS_ALL) || origem !== ORIGEM_ALL || emailAvailability !== "todos";

  const reset = () => {
    setUf("");
    setMunicipio("");
    setBairro("");
    setStatus(STATUS_ALL);
    setOrigem(ORIGEM_ALL);
    setSegmentos([]);
    setEmailAvailability("todos");
    onResetFilters();
  };

  return (
    <section className="w-full" aria-label="Filtros dos leads">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h2 className={cn(ui.cardTitle, "flex items-center gap-2")}>
          <Filter size={17} className="text-brand" aria-hidden="true" /> Filtros
        </h2>
        {hasFilters && (
          <button type="button" onClick={reset} className="text-xs font-semibold text-brand hover:underline underline-offset-4">
            Limpar filtros
          </button>
        )}
      </div>

      <form
        className={cn(
          "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 items-end",
          "2xl:grid-cols-4"
        )}
        onSubmit={(event) => {
          event.preventDefault();
          onApplyFilters({ uf, municipio, bairro, statusSelect: showStatusFilter ? status : STATUS_ALL, origem, segmentos, emailAvailability });
        }}
      >
        <Select id={`${id}-uf`} label="UF" value={uf} onChange={(value) => { setUf(value); setMunicipio(""); setBairro(""); }}>
          <option value="">Todas as UFs</option>
          {ufsList.map((item) => <option key={item} value={item}>{item}</option>)}
        </Select>

        <Select id={`${id}-mun`} label="Município" value={municipio} disabled={!uf} onChange={(value) => { setMunicipio(value); setBairro(""); }}>
          <option value="">{uf ? "Todos os municípios" : "Escolha uma UF"}</option>
          {municipios.map((item) => <option key={item} value={item}>{item}</option>)}
        </Select>

        <Select id={`${id}-bairro`} label="Bairro" value={bairro} disabled={!municipio} onChange={setBairro}>
          <option value="">{municipio ? "Todos os bairros" : "Escolha um município"}</option>
          {bairros.map((item) => <option key={item} value={item}>{item}</option>)}
        </Select>

        {showStatusFilter && (
          <Select id={`${id}-status`} label="Status" value={status} onChange={setStatus}>
            <option value={STATUS_ALL}>{STATUS_ALL}</option>
            {statusOptions.map(item => <option key={item} value={item}>{item}</option>)}
          </Select>
        )}

        <ProspectMultiSelect label="Tipo de estabelecimento" options={ESTABLISHMENTS} values={segmentos} onChange={setSegmentos} />

        <Select id={`${id}-origem`} label="Origem" value={origem} onChange={setOrigem}>
          <option value={ORIGEM_ALL}>{ORIGEM_ALL}</option>
          {(availableOrigins ?? ["Google Maps", "Google Meu Negócio", "Outras fontes"]).map(item => <option key={item} value={item}>{item}</option>)}
        </Select>

        <Select id={`${id}-email`} label="E-mail" value={emailAvailability} onChange={(value) => setEmailAvailability(value as EmailAvailability)}>
          <option value="todos">Todos</option>
          <option value="com">Com e-mail</option>
          <option value="sem">Sem e-mail</option>
        </Select>

        <button type="submit" className={cn(ui.btnBrand, "h-10 text-xs")}>
          <Filter size={15} aria-hidden="true" /> Aplicar filtros
        </button>
      </form>
    </section>
  );
}
