import { useId, useMemo, useState } from "react";
import { Filter } from "lucide-react";
import { getUFs } from "../../lib/mock-leads";
import { ui } from "../../lib/ui";
import { cn } from "../../lib/utils";
import type { EmailAvailability } from "../../lib/email";
import type { LeadStatus } from "../../lib/mock-leads";
import { ESTABLISHMENTS } from "../../lib/prospect-options";
import { Select } from "../ui/select";

export interface SideFilters {
  uf: string;
  statusSelect: string;
  origem: string;
  segmentos: string[];
  emailAvailability: EmailAvailability;
}

interface FiltersSidebarProps {
  selectedUF: string;
  selectedStatus: string;
  selectedOrigem: string;
  selectedSegmentos: string[];
  selectedEmailAvailability: EmailAvailability;
  onApplyFilters: (filters: SideFilters) => void;
  onResetFilters: () => void;
  availableUFs?: string[];
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
  selectedStatus,
  selectedOrigem,
  selectedSegmentos,
  selectedEmailAvailability,
  onApplyFilters,
  onResetFilters,
  availableUFs,
  availableOrigins,
  statusOptions = ["Qualificado", "Não qualificado", "Em contato", "Respondido", "Não contatado"],
  showStatusFilter = true,
}: FiltersSidebarProps) {
  const id = useId();
  const [uf, setUf] = useState(selectedUF);
  const [status, setStatus] = useState(selectedStatus || STATUS_ALL);
  const [origem, setOrigem] = useState(selectedOrigem || ORIGEM_ALL);
  const [segmentos, setSegmentos] = useState(selectedSegmentos);
  const [emailAvailability, setEmailAvailability] = useState<EmailAvailability>(selectedEmailAvailability);

  const ufOptions = useMemo(
    () => [{ value: "", label: "Todas as UFs" }, ...(availableUFs ?? getUFs()).map((item) => ({ value: item, label: item }))],
    [availableUFs]
  );
  const statusSelectOptions = useMemo(
    () => [{ value: STATUS_ALL, label: STATUS_ALL }, ...statusOptions.map((item) => ({ value: item, label: item }))],
    [statusOptions]
  );
  const origemOptions = useMemo(
    () => [{ value: ORIGEM_ALL, label: ORIGEM_ALL }, ...(availableOrigins ?? ["Google Maps", "Google Meu Negócio", "Outras fontes"]).map((item) => ({ value: item, label: item }))],
    [availableOrigins]
  );

  const hasFilters = Boolean(uf || segmentos.length) || (showStatusFilter && status !== STATUS_ALL) || origem !== ORIGEM_ALL || emailAvailability !== "todos";

  const reset = () => {
    setUf("");
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
        className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 items-end"
        onSubmit={(event) => {
          event.preventDefault();
          onApplyFilters({ uf, statusSelect: showStatusFilter ? status : STATUS_ALL, origem, segmentos, emailAvailability });
        }}
      >
        <Select
          id={`${id}-uf`}
          label="UF"
          value={uf}
          options={ufOptions}
          onChange={setUf}
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

        <button type="submit" className={cn(ui.btnBrand, "h-10 text-xs sm:col-span-2 xl:col-span-4 justify-self-start px-6")}>
          <Filter size={15} aria-hidden="true" /> Aplicar filtros
        </button>
      </form>
    </section>
  );
}
