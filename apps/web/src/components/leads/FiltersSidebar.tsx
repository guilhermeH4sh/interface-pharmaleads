import { useId, useMemo, useState } from "react";
import { Filter } from "lucide-react";
import { getUFs, getMunicipios, getBairros } from "../../lib/mock-leads";
import { ui } from "../../lib/ui";
import { cn } from "../../lib/utils";
import type { EmailAvailability } from "../../lib/email";
import type { LeadStatus } from "../../lib/mock-leads";
import { ESTABLISHMENTS } from "../../lib/prospect-options";
import { Select } from "../ui/select";

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
const EMAIL_OPTIONS = [
  { value: "todos", label: "Todos" },
  { value: "com", label: "Com e-mail" },
  { value: "sem", label: "Sem e-mail" },
];

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

  const ufsList = useMemo(
    () => (dynamicLocations !== undefined ? Object.keys(dynamicLocations).sort() : getUFs()),
    [dynamicLocations]
  );
  const municipios = useMemo(
    () =>
      uf
        ? dynamicLocations !== undefined
          ? Object.keys(dynamicLocations[uf] || {}).sort()
          : getMunicipios(uf)
        : [],
    [uf, dynamicLocations]
  );
  const bairros = useMemo(
    () =>
      uf && municipio
        ? dynamicLocations !== undefined
          ? dynamicLocations[uf]?.[municipio] || []
          : getBairros(uf, municipio)
        : [],
    [uf, municipio, dynamicLocations]
  );
  const ufOptions = useMemo(
    () => [{ value: "", label: "Todas as UFs" }, ...ufsList.map((item) => ({ value: item, label: item }))],
    [ufsList]
  );
  const municipioOptions = useMemo(
    () => [{ value: "", label: uf ? "Todos os municípios" : "Escolha uma UF" }, ...municipios.map((item) => ({ value: item, label: item }))],
    [uf, municipios]
  );
  const bairroOptions = useMemo(
    () => [{ value: "", label: municipio ? "Todos os bairros" : "Escolha um município" }, ...bairros.map((item) => ({ value: item, label: item }))],
    [municipio, bairros]
  );
  const statusSelectOptions = useMemo(
    () => [{ value: STATUS_ALL, label: STATUS_ALL }, ...statusOptions.map((item) => ({ value: item, label: item }))],
    [statusOptions]
  );
  const origemOptions = useMemo(
    () => [{ value: ORIGEM_ALL, label: ORIGEM_ALL }, ...(availableOrigins ?? ["Google Maps", "Google Meu Negócio", "Outras fontes"]).map((item) => ({ value: item, label: item }))],
    [availableOrigins]
  );

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
        <Select
          id={`${id}-uf`}
          label="UF"
          value={uf}
          options={ufOptions}
          onChange={(value) => { setUf(value); setMunicipio(""); setBairro(""); }}
          triggerClassName="h-10"
        />

        <Select
          id={`${id}-mun`}
          label="Município"
          value={municipio}
          disabled={!uf}
          options={municipioOptions}
          onChange={(value) => { setMunicipio(value); setBairro(""); }}
          triggerClassName="h-10"
        />

        <Select
          id={`${id}-bairro`}
          label="Bairro"
          value={bairro}
          disabled={!municipio}
          options={bairroOptions}
          onChange={setBairro}
          triggerClassName="h-10"
        />

        {showStatusFilter && (
          <Select
            id={`${id}-status`}
            label="Status"
            value={status}
            options={statusSelectOptions}
            onChange={setStatus}
            triggerClassName="h-10"
          />
        )}

        <Select
          id={`${id}-seg`}
          label="Tipo de estabelecimento"
          multiple
          values={segmentos}
          onChange={setSegmentos}
          options={ESTABLISHMENTS}
          triggerClassName="h-10"
        />

        <Select
          id={`${id}-origem`}
          label="Origem"
          value={origem}
          options={origemOptions}
          onChange={setOrigem}
          triggerClassName="h-10"
        />

        <Select
          id={`${id}-email`}
          label="E-mail"
          value={emailAvailability}
          options={EMAIL_OPTIONS}
          onChange={(value) => setEmailAvailability(value as EmailAvailability)}
          triggerClassName="h-10"
        />

        <button type="submit" className={cn(ui.btnBrand, "h-10 text-xs")}>
          <Filter size={15} aria-hidden="true" /> Aplicar filtros
        </button>
      </form>
    </section>
  );
}
