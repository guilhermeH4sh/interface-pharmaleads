import { useEffect, useRef, useState } from "react";
import { Search, Square } from "lucide-react";
import { AccessError, COLETA_ATIVA_STATES, controlCloudCollector, fetchCloudCollectorRun,
  type CollectorRun, type SupabaseSession } from "../../lib/backend";
import { buildCollectorSearch, findCollectorState } from "../../lib/collector-search";
import { ESTABLISHMENTS, SOURCES, STATES } from "../../lib/prospect-options";
import { ui } from "../../lib/ui";
import { cn } from "../../lib/utils";
import { CollectorProgress } from "../prospeccao/CollectorProgress";
import { Modal } from "../ui/modal";
import { Select } from "../ui/select";

type SearchFilters = { uf: string; origem: string; segmentos: string[] };

interface Props {
  session?: SupabaseSession | null;
  filters: SearchFilters;
  modalOpen: boolean;
  closeModal: () => void;
  onSearch: (filters: SearchFilters) => void;
  onResultsChange: (uf: string, startedAt: string) => void;
  onSessionUpdate?: (session: SupabaseSession) => void;
  onSessionInvalid?: () => void;
  disabled?: boolean;
}

const isActive = (run: CollectorRun | null) =>
  Boolean(run && (COLETA_ATIVA_STATES.includes(run.status) || run.status === "cancelling"));

export function LeadSearch({ session, filters, modalOpen, closeModal, onSearch, onResultsChange,
  onSessionUpdate, onSessionInvalid, disabled }: Props) {
  const [entry, setEntry] = useState<{ uf: string; text: string }>();
  const text = entry?.uf === filters.uf ? entry.text : filters.uf;
  const [draft, setDraft] = useState<SearchFilters>();
  const [run, setRun] = useState<CollectorRun | null>(null);
  const [statusError, setStatusError] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [dismissed, setDismissed] = useState<CollectorRun["id"]>();
  const [retryAction, setRetryAction] = useState<"start" | "stop">();
  const [retry, setRetry] = useState(0);
  const [busy, setBusy] = useState(false);
  const active = isActive(run);
  const pending = useRef(false);
  const submitted = useRef<SearchFilters | null>(null);
  const tracked = useRef<{ id: CollectorRun["id"]; uf: string; synced: number; startedAt: string } | null>(null);
  const modalFilters = draft ?? filters;

  useEffect(() => {
    if (!session || busy) return;
    const controller = new AbortController();
    let polling = false;
    async function poll() {
      if (!session || polling) return;
      polling = true;
      try {
        const result = await fetchCloudCollectorRun(session, controller.signal);
        if (controller.signal.aborted) return;
        setRun(result.run);
        setStatusError("");
        if (result.session !== session) onSessionUpdate?.(result.session);
        const target = tracked.current;
        const synced = result.run?.synced_leads ?? 0;
        if (target && result.run?.id === target.id && synced > target.synced) {
          target.synced = synced;
          onResultsChange(target.uf, target.startedAt);
        }
      } catch (error) {
        if (controller.signal.aborted) return;
        if (error instanceof AccessError) onSessionInvalid?.();
        setStatusError(error instanceof Error && error.name !== "TimeoutError"
          ? error.message : "O coletor não respondeu. Tente novamente.");
      } finally { polling = false; }
    }
    void poll();
    const timer = window.setInterval(() => void poll(), 5000);
    return () => { controller.abort(); window.clearInterval(timer); };
  }, [session, busy, retry, onResultsChange, onSessionUpdate, onSessionInvalid]);

  async function control(action: "start" | "stop", search?: SearchFilters) {
    if (!session || pending.current) return;
    if (action === "start" && active) {
      setNotice("Já há uma coleta em andamento. Os leads salvos continuam disponíveis.");
      return;
    }
    pending.current = true;
    setBusy(true);
    setError("");
    setRetryAction(undefined);
    try {
      const startedAt = new Date().toISOString();
      const input = search ? buildCollectorSearch("", search.uf, search.segmentos.length
        ? search.segmentos : ESTABLISHMENTS.map(item => item.value), "Google Maps") : undefined;
      const payload = input ? { action, ...input, locais: input.locais.join("\n"), enriquecerSites: false } : { action };
      const response = await controlCloudCollector(session, payload);
      setRun(response.run);
      setStatusError("");
      if (response.session !== session) onSessionUpdate?.(response.session);
      if (search && response.run) tracked.current = { id: response.run.id, uf: search.uf, synced: 0, startedAt };
    } catch (error) {
      if (error instanceof AccessError) onSessionInvalid?.();
      setError(error instanceof Error ? error.message : "Não foi possível controlar a coleta.");
      setRetryAction(action);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  function search(next: SearchFilters) {
    setError("");
    setNotice("");
    setRetryAction(undefined);
    if (!findCollectorState(next.uf)) {
      setError("Escolha um estado para pesquisar.");
      return;
    }
    submitted.current = next;
    onSearch(next);
    setEntry({ uf: next.uf, text: next.uf });
    closeModal();
    setDraft(undefined);
    if (!session) return;
    if (!next.origem || next.origem === "Todas as origens" || next.origem === "Google Maps") {
      void control("start", next);
    } else {
      setNotice("A fonte selecionada está disponível no catálogo. A coleta em tempo real usa Google Maps.");
    }
  }

  return (
    <section aria-label="Pesquisa por estado" className="space-y-3">
      <form className="flex items-center gap-2 rounded-full border border-input bg-card px-4 py-2 shadow-sm focus-within:ring-2 focus-within:ring-primary/20"
        onSubmit={event => {
          event.preventDefault();
          const state = text.trim() ? findCollectorState(text) : findCollectorState(filters.uf);
          search({ ...filters, uf: state?.value ?? "" });
        }}>
        <Search size={20} className="shrink-0 text-muted-foreground" aria-hidden="true" />
        <input type="search" aria-label="Digite o estado" placeholder="Digite o estado"
          value={text} onChange={event => setEntry({ uf: filters.uf, text: event.target.value })}
          className="h-10 w-full min-w-0 bg-transparent text-sm outline-none" />
        <button type="submit" className={cn(ui.btnBrand, "h-10 shrink-0 rounded-full px-4 sm:px-6")}
          disabled={disabled}>Pesquisar</button>
      </form>
      {notice && <p role="status" className="text-sm text-muted-foreground">{notice}</p>}
      {(error || statusError) && (
        <div className="space-y-2 text-sm">
          <p role="alert">{error || statusError}</p>
          {(retryAction || statusError) && (
            <button type="button" className={ui.btnSecondary} disabled={busy} onClick={() => {
              if (retryAction === "stop") void control("stop");
              else if (retryAction === "start" && submitted.current) void control("start", submitted.current);
              else { setError(""); setRetry(value => value + 1); }
            }}>Tentar novamente</button>
          )}
        </div>
      )}
      {run && (active || dismissed !== run.id) && <CollectorProgress run={run} stale={Boolean(statusError)} onDismiss={() => setDismissed(run.id)} />}
      {active && (
        <button type="button" className={ui.btnSecondary} disabled={busy || run?.status === "cancelling"}
          onClick={() => void control("stop")}>
          <Square size={14} /> {run?.status === "cancelling" ? "Parando…" : "Parar coleta"}
        </button>
      )}
      <Modal open={modalOpen} onClose={() => { setDraft(undefined); closeModal(); }} title="Nova Prospecção">
        <form className="space-y-4" onSubmit={event => { event.preventDefault(); search(modalFilters); }}>
          <Select label="UF" value={modalFilters.uf} options={[{ value: "", label: "Escolha um estado" }, ...STATES]}
            onChange={uf => setDraft({ ...modalFilters, uf })} />
          <Select label="Fonte dos dados" value={modalFilters.origem}
            options={[{ value: "Todas as origens", label: "Todas as fontes" }, ...SOURCES]}
            onChange={origem => setDraft({ ...modalFilters, origem })} />
          <Select label="Tipo de estabelecimento" multiple values={modalFilters.segmentos} options={ESTABLISHMENTS}
            onChange={segmentos => setDraft({ ...modalFilters, segmentos })} />
          <button type="submit" disabled={!modalFilters.uf || active || busy || disabled} className={ui.btnBrand}>
            Iniciar pesquisa
          </button>
          {active && <p className="text-sm text-muted-foreground">Aguarde a coleta em andamento ou use Parar coleta.</p>}
        </form>
      </Modal>
    </section>
  );
}
