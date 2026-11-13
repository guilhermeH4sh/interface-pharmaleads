import { useCallback, useEffect, useRef, useState } from "react";
import { Search, Square, ArrowRight } from "lucide-react";
import { AccessError, COLETA_ATIVA_STATES, controlCloudCollector, fetchCloudCollectorRun, fetchLocalApiStatus, startLocalCollection, stopLocalCollection, type CollectorRun, type DataSourceMode, type SupabaseSession } from "../../lib/backend";
import { buildCollectorSearch } from "../../lib/collector-search";
import { ESTABLISHMENTS, STATES, SOURCES } from "../../lib/prospect-options";
import { ui } from "../../lib/ui";
import { cn } from "../../lib/utils";
import { ProspectMultiSelect } from "./ProspectMultiSelect";
import { CollectorProgress } from "./CollectorProgress";

const DISMISSED_CLOUD_RUN_KEY = "pharmaleads-dismissed-cloud-run";

interface Props {
  dataSourceMode?: DataSourceMode;
  supabaseSession?: SupabaseSession | null;
  onSessionUpdate?: (session: SupabaseSession) => void;
  onRefreshLeads?: () => void;
  onOpenLeads?: () => void;
  onSessionInvalid?: () => void;
}

export function ProspeccaoTab({ dataSourceMode = "mock", supabaseSession = null, onSessionUpdate, onRefreshLeads, onOpenLeads, onSessionInvalid }: Props) {
  const [text, setText] = useState("");
  const [uf, setUf] = useState("");
  const [source, setSource] = useState("Google Maps");
  const [segments, setSegments] = useState<string[]>(["varejo"]);
  const [localActive, setActive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [localStopping, setStopping] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const [cloudRun, setCloudRun] = useState<CollectorRun | null>(null);
  const [cloudError, setCloudError] = useState("");
  const [cloudReady, setCloudReady] = useState(false);
  const [retry, setRetry] = useState(0);
  const hadActive = useRef(false);
  const cloud = dataSourceMode === "supabase";
  const cloudStale = Boolean(cloudError);
  const active = cloud
    ? Boolean(cloudRun && (COLETA_ATIVA_STATES.includes(cloudRun.status) || cloudRun.status === "cancelling"))
    : localActive;
  const stopping = cloud ? cloudRun?.status === "cancelling" : localStopping;
  const connected = dataSourceMode === "local" || (dataSourceMode === "supabase" && Boolean(supabaseSession));

  useEffect(() => {
    if (busy) return;
    const controller = new AbortController();
    let cancelled = false;
    let polling = false;
    async function poll() {
      if (polling) return;
      polling = true;
      try {
        if (dataSourceMode === "supabase" && supabaseSession) {
          const result = await fetchCloudCollectorRun(supabaseSession, controller.signal);
          if (cancelled) return;
          if (result.session !== supabaseSession) onSessionUpdate?.(result.session);
          const run = result.run;
          const dismissedId = window.sessionStorage.getItem(DISMISSED_CLOUD_RUN_KEY);
          const hiddenTerminalRun = run?.status === "completed" && dismissedId === String(run.id);
          setCloudRun(hiddenTerminalRun ? null : run);
          setCloudError("");
          setCloudReady(true);
          const running = Boolean(run && (COLETA_ATIVA_STATES.includes(run.status) || run.status === "cancelling"));
          if (hadActive.current && !running) onRefreshLeads?.();
          hadActive.current = running;
        } else if (dataSourceMode === "local") {
          const status = await fetchLocalApiStatus();
          if (cancelled || !status?.execucao) return;
          const run = status.execucao;
          const running = ["executando", "parando"].includes(run.estado);
          setActive(running);
          setStopping(previous => run.estado === "parando" || (previous && running));
          if (running) {
            hadActive.current = true;
            setFeedback(run.estado === "parando" ? "Parando coleta..." : "Coleta em andamento. Os novos contatos ficam na aba Leads.");
          } else if (hadActive.current) {
            hadActive.current = false;
            setFeedback(run.erro || "Coleta encerrada. Consulte os contatos na aba Leads.");
            onRefreshLeads?.();
          }
        }
      } catch (err) {
        if (!cancelled && err instanceof AccessError) onSessionInvalid?.();
        if (!cancelled && dataSourceMode === "supabase") {
          const detail = err instanceof Error && !["TimeoutError", "TypeError"].includes(err.name)
            ? err.message
            : "O coletor no Render está indisponível ou iniciando.";
          setCloudError(detail);
        } else if (!cancelled) {
          setError(err instanceof Error ? err.message : "Não foi possível acompanhar a coleta.");
        }
      } finally {
        polling = false;
      }
    }
    queueMicrotask(() => { if (!cancelled) void poll(); });
    const timer = window.setInterval(() => void poll(), dataSourceMode === "local" ? 3000 : 5000);
    return () => { cancelled = true; controller.abort(); window.clearInterval(timer); };
  }, [busy, dataSourceMode, supabaseSession, onSessionUpdate, onRefreshLeads, onSessionInvalid, retry]);

  const start = useCallback(async (override?: string) => {
    setError("");
    if (!connected) { setError("Conecte o Supabase em Configurações para iniciar a coleta."); return; }
    if (cloud && (!cloudReady || cloudStale)) return;
    setBusy(true);
    try {
      const input = buildCollectorSearch(override ?? text, override ? "" : uf, segments, source);
      if (dataSourceMode === "supabase" && supabaseSession) {
        const result = await controlCloudCollector(supabaseSession, { action: "start", ...input, locais: input.locais.join("\n"), enriquecerSites: false });
        if (result.session !== supabaseSession) onSessionUpdate?.(result.session);
        setCloudRun(result.run);
        setCloudError("");
        setFeedback("");
      } else {
        if (input.cobertura === "nacional") throw new Error("Conecte o Supabase para iniciar uma busca em todas as UFs.");
        await startLocalCollection(input);
        setFeedback("Coleta solicitada. Os novos contatos serão enviados para a aba Leads.");
      }
      setText(input.locais[0] ?? "");
      hadActive.current = true;
      if (!cloud) {
        setStopping(false);
        setActive(true);
      }
    } catch (err) {
      if (err instanceof AccessError) onSessionInvalid?.();
      setError(err instanceof Error ? err.message : "Não foi possível iniciar a coleta.");
    } finally { setBusy(false); }
  }, [connected, cloud, cloudReady, cloudStale, text, uf, segments, source, dataSourceMode, supabaseSession, onSessionUpdate, onSessionInvalid]);


  async function stop() {
    setBusy(true);
    setError("");
    try {
      if (dataSourceMode === "supabase" && supabaseSession) {
        const result = await controlCloudCollector(supabaseSession, { action: "stop" });
        if (result.session !== supabaseSession) onSessionUpdate?.(result.session);
        setCloudRun(result.run);
        setCloudError("");
      } else {
        await stopLocalCollection();
        setStopping(true);
        setFeedback("Parada solicitada. Aguardando o encerramento da coleta...");
      }
    } catch (err) {
      if (!cloud) setStopping(false);
      if (err instanceof AccessError) onSessionInvalid?.();
      setError(err instanceof Error ? err.message : "Falha ao solicitar parada.");
    }
    finally { setBusy(false); }
  }

  return (
    <section className="min-h-[calc(100dvh-180px)] flex flex-col items-center justify-center py-12 sm:py-16" aria-label="Prospecção">
      <div className="w-full max-w-3xl mx-auto">
        <h1 className={cn(ui.pageTitle, "text-center")}>Encontre novas farmácias</h1>
        <p className="text-center text-sm text-muted-foreground mt-3 mb-8">Escolha onde e o que o scraper deve buscar.</p>
        <form onSubmit={event => { event.preventDefault(); void start(); }} className="space-y-5">
          <div className="flex items-center gap-2 rounded-full border border-input bg-card px-4 py-2 shadow-sm hover:shadow-md focus-within:ring-2 focus-within:ring-primary/20 transition-shadow">
            <Search size={20} className="text-muted-foreground shrink-0" aria-hidden="true" />
            <input type="search" aria-label="Cidade ou bairro" placeholder="Cidade ou bairro" value={text} onChange={event => setText(event.target.value)} disabled={busy || active}
              className="w-full min-w-0 bg-transparent text-foreground h-10 text-sm outline-none focus-visible:outline-none" />
            <button type="submit" disabled={busy || active || !connected || (cloud && (!cloudReady || cloudStale))} aria-label="Pesquisar" className={cn(ui.btnBrand, "rounded-full h-10 px-4 sm:px-6 text-sm shrink-0")}>Pesquisar</button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label htmlFor="prospect-uf" className={cn(ui.label, "block mb-1.5")}>UF</label>
              <select id="prospect-uf" value={uf} onChange={event => setUf(event.target.value)} disabled={busy || active} className={ui.input}>
                <option value="">Todas as UFs</option>
                {STATES.map(state => <option key={state.value} value={state.value}>{state.label}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="prospect-source" className={cn(ui.label, "block mb-1.5")}>Fonte dos dados</label>
              <select id="prospect-source" value={source} onChange={event => setSource(event.target.value)} disabled={busy || active} className={ui.input}>
                {SOURCES.map(option => <option key={option.value} value={option.value} disabled={option.value !== "Google Maps"}>{option.label}{option.value !== "Google Maps" ? " (em breve)" : ""}</option>)}
              </select>
            </div>
            <ProspectMultiSelect label="Tipo de estabelecimento" options={ESTABLISHMENTS} values={segments} onChange={setSegments} />
          </div>
        </form>
        {!connected && <p className="mt-5 text-xs text-muted-foreground text-center">Conecte sua conta Supabase em Configurações para iniciar.</p>}
        {error && <p role="alert" className="mt-5 text-sm text-foreground text-center">{error}</p>}
        {feedback && <p role="status" className="mt-5 text-sm text-muted-foreground text-center">{feedback}</p>}
        {dataSourceMode === "supabase" && cloudRun && <CollectorProgress run={cloudRun} stale={cloudStale} onDismiss={() => {
          window.sessionStorage.setItem(DISMISSED_CLOUD_RUN_KEY, String(cloudRun.id));
          setCloudRun(null);
        }} />}
        {cloud && connected && !cloudReady && !cloudStale && (
          <p role="status" className="mt-5 text-center text-sm text-muted-foreground">Consultando o coletor no Render…</p>
        )}
        {cloud && cloudStale && (
          <div className="mt-5 text-center text-sm">
            <p role="alert">{cloudError} Tentando reconectar automaticamente.</p>
            <button type="button" className={cn(ui.btnSecondary, "mt-2")} onClick={() => setRetry(value => value + 1)}>Tentar novamente</button>
          </div>
        )}
        {busy && <p aria-live="polite" className="mt-5 text-center text-sm">Enviando solicitação ao coletor…</p>}
        <div className="mt-6 flex flex-wrap justify-center items-center gap-4 text-sm">
          {active && <button type="button" onClick={() => void stop()} disabled={busy || stopping || (cloud && cloudStale)} aria-live="polite" className={cn(ui.btnSecondary, "h-10 px-4")}><Square size={14} /> {stopping ? "Parando…" : "Parar coleta"}</button>}
          <button type="button" onClick={onOpenLeads} className="inline-flex items-center gap-1.5 text-brand hover:underline">Ver leads <ArrowRight size={15} /></button>
        </div>
      </div>
    </section>
  );
}
