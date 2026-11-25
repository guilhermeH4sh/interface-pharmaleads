import { useState, type FormEvent } from "react";
import { Search } from "lucide-react";
import { ESTABLISHMENTS, SOURCES, STATES } from "../../lib/prospect-options";
import { ui } from "../../lib/ui";
import { cn } from "../../lib/utils";
import { Modal } from "../ui/modal";
import { Select } from "../ui/select";

type SearchFilters = { uf: string; origem: string; segmentos: string[] };
interface Props {
  filters: SearchFilters;
  hasSearched: boolean;
  modalOpen: boolean;
  closeModal: () => void;
  onSearch: (filters: SearchFilters) => void;
  disabled?: boolean;
}
const ALL = "__all__";
const REGIONS = [{ value: "", label: "Escolha um estado" }, { value: ALL, label: "Todas as UFs" }, ...STATES];

export function LeadSearch({ filters, hasSearched, modalOpen, closeModal, onSearch, disabled }: Props) {
  const [draft, setDraft] = useState<SearchFilters>();
  const choice = draft ?? { ...filters, uf: hasSearched ? filters.uf || ALL : "" };
  const valid = choice.uf === ALL || STATES.some(state => state.value === choice.uf);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!valid) return;
    onSearch({ ...choice, uf: choice.uf === ALL ? "" : choice.uf });
    setDraft(undefined);
    closeModal();
  };
  const fields = (modal: boolean) => <>
    <Select label={modal ? "UF" : "Estado da pesquisa"} value={choice.uf} options={REGIONS}
      onChange={uf => setDraft({ ...choice, uf })} />
    <Select label={modal ? "Tipo de estabelecimento" : "Tipo de estabelecimento da pesquisa"} multiple values={choice.segmentos} options={ESTABLISHMENTS}
      onChange={segmentos => setDraft({ ...choice, segmentos })} />
  </>;
  return <section aria-label="Pesquisa de leads salvos" className="space-y-3">
    <form onSubmit={submit} className={cn(ui.card, "grid gap-4 p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end")}>
      {fields(false)}
      <button type="submit" disabled={disabled || !valid} className={cn(ui.btnBrand, "h-11 px-6")}>
        <Search size={18} /> Pesquisar
      </button>
    </form>
    <p className="text-sm text-muted-foreground">Consulte os leads salvos por estado ou em todo o Brasil. A coleta automática atualiza a base três vezes ao dia.</p>
    <Modal open={modalOpen} onClose={() => { setDraft(undefined); closeModal(); }} title="Nova pesquisa">
      <form onSubmit={submit} className="space-y-4">
        {fields(true)}
        <Select label="Fonte dos dados" value={choice.origem}
          options={[{ value: "Todas as origens", label: "Todas as fontes" }, ...SOURCES]}
          onChange={origem => setDraft({ ...choice, origem })} />
        <button type="submit" disabled={disabled || !valid} className={cn(ui.btnBrand, "h-11 px-6")}>
          Pesquisar leads
        </button>
      </form>
    </Modal>
  </section>;
}
