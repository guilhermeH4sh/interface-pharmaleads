import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Search,
  Play,
  Square,
  MapPin,
  Sliders,
  Globe,
  Mail,
  Zap,
  ExternalLink,
  AlertCircle,
} from "lucide-react";
import { corrigirLocal } from "../../lib/locations";
import { ui } from "../../lib/ui";
import { cn } from "../../lib/utils";
import {
  COLETA_ATIVA_STATES,
  computeUfCoverage,
  controlCloudCollector,
  fetchCloudCollectorRun,
  fetchLocalApiStatus,
  startLocalCollection,
  stopLocalCollection,
  type CollectorRun,
  type DataSourceMode,
  type SupabaseSession,
} from "../../lib/backend";
import type { Status as LocalApiStatus } from "../../lib/crm";
import type { LeadItem } from "../../lib/mock-leads";
import { ProspectSearch } from "./ProspectSearch";

const UFS = [
  "AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO", "MA",
  "MG", "MS", "MT", "PA", "PB", "PE", "PI", "PR", "RJ", "RN",
  "RO", "RR", "RS", "SC", "SE", "SP", "TO",
];
const TERMOS_POR_SEGMENTO: Record<string, number> = {
  varejo: 3,
  manipulacao: 1,
  homeopatia: 1,
  veterinaria: 1,
  distribuidoras: 2,
};

interface ProspeccaoTabProps {
  dataSourceMode?: DataSourceMode;
  supabaseSession?: SupabaseSession | null;
  onSessionUpdate?: (session: SupabaseSession) => void;
  realLeads?: LeadItem[];
  onRefreshLeads?: () => void;
  collectionRequest?: { id: number; local: string } | null;
}

function formatUltimaColeta(valor?: string): string {
  if (!valor) return "Sem coleta";
  const d = new Date(valor);
  return Number.isNaN(d.getTime())
    ? "Sem coleta"
    : d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export function ProspeccaoTab({
  dataSourceMode = "mock",
  supabaseSession = null,
  onSessionUpdate,
  realLeads = [],
  onRefreshLeads,
  collectionRequest = null,
}: ProspeccaoTabProps) {
  const [localDraft, setLocalDraft] = useState("");
  const [localSuggestion, setLocalSuggestion] = useState("");
  const [locais, setLocais] = useState<string[]>([
    "Curitiba, PR",
    "Campinas, SP",
    "Goiânia, GO",
  ]);
  const [coberturaNacional, setCoberturaNacional] = useState(false);
  const [segmentos, setSegmentos] = useState<string[]>(["varejo", "manipulacao"]);
  const [profundidade, setProfundidade] = useState(2);
  const [enriquecerSites, setEnriquecerSites] = useState(false);
  const [buscarEmails, setBuscarEmails] = useState(false);

  // Estado da execução Local (API Python + Gosom)
  const [localStatus, setLocalStatus] = useState<LocalApiStatus | null>(null);
  // Estado da execução Cloud (GitHub Actions /api/collector)
  const [cloudRun, setCloudRun] = useState<CollectorRun | null>(null);
  const refreshedCloudRunRef = useRef<number | null>(null);
  const cloudWasActiveRef = useRef(false);
  const [isBusy, setIsBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [statusMsg, setStatusMsg] = useState("Pronto para iniciar coleta automatizada.");
  const prevLocalTotalRef = useRef<number>(0);
  const handledRequestRef = useRef<number | null>(null);

  // Polling de status para API Local (quando em modo local)
  const pollLocalStatus = useCallback(async () => {
    if (dataSourceMode !== "local") return;
    const status = await fetchLocalApiStatus();
    if (!status) return;
    setLocalStatus(status);
    if (prevLocalTotalRef.current > 0 && status.total_leads !== prevLocalTotalRef.current) {
      onRefreshLeads?.();
    }
    prevLocalTotalRef.current = status.total_leads;

    const run = status.execucao;
    if (run) {
      if (run.estado === "executando") {
        setStatusMsg(
          status.consulta_atual
            ? `Executando Gosom: "${status.consulta_atual}" (${run.concluidas}/${run.total})`
            : `Coleta local em andamento (${run.concluidas}/${run.total} buscas)...`
        );
      } else if (run.estado === "parando") {
        setStatusMsg("Encerrando processo Gosom local...");
      } else if (run.estado === "concluida") {
        setStatusMsg(
          `Última coleta concluída (${run.concluidas}/${run.total} buscas) · ${status.total_leads} leads no SQLite.`
        );
      } else if (run.erro) {
        setStatusMsg(`Execução encerrada (${run.estado}): ${run.erro}`);
      }
    }
  }, [dataSourceMode, onRefreshLeads]);

  // Polling de status para Cloud Collector (quando em modo supabase autenticado)
  const pollCloudStatus = useCallback(async () => {
    if (dataSourceMode !== "supabase" || !supabaseSession) return;
    try {
      const res = await fetchCloudCollectorRun(supabaseSession);
      if (res.session !== supabaseSession) onSessionUpdate?.(res.session);
      setCloudRun(res.run);
      if (res.run) {
        const st = res.run.status;
        if (COLETA_ATIVA_STATES.includes(st)) cloudWasActiveRef.current = true;
        if (st === "completed" && cloudWasActiveRef.current && refreshedCloudRunRef.current !== res.run.id) {
          onRefreshLeads?.();
          refreshedCloudRunRef.current = res.run.id;
          cloudWasActiveRef.current = false;
        }
        if (COLETA_ATIVA_STATES.includes(st)) {
          setStatusMsg(`GitHub Actions em execução: ${res.run.title || st}`);
        } else if (st === "completed") {
          setStatusMsg(
            `Última execução GitHub Actions: ${
              res.run.conclusion === "success"
                ? "Concluída com sucesso"
                : res.run.conclusion === "cancelled"
                  ? "Cancelada"
                  : "Finalizada"
            } (${res.run.title || "cloud-collect"})`
          );
        }
      }
    } catch {
      // Em desenvolvimento local sem GITHUB_ACTIONS_TOKEN na Vercel, mantém silencioso no poll
    }
  }, [dataSourceMode, supabaseSession, onSessionUpdate, onRefreshLeads]);

  useEffect(() => {
    let cancelled = false;
    if (dataSourceMode === "local") {
      queueMicrotask(() => {
        if (!cancelled) void pollLocalStatus();
      });
      const timer = window.setInterval(() => void pollLocalStatus(), 3000);
      return () => {
        cancelled = true;
        window.clearInterval(timer);
      };
    }
    if (dataSourceMode === "supabase" && supabaseSession) {
      queueMicrotask(() => {
        if (!cancelled) void pollCloudStatus();
      });
      const timer = window.setInterval(() => void pollCloudStatus(), 5000);
      return () => {
        cancelled = true;
        window.clearInterval(timer);
      };
    }
    return undefined;
  }, [dataSourceMode, supabaseSession, pollLocalStatus, pollCloudStatus]);

  const isLocalRunning =
    dataSourceMode === "local" &&
    Boolean(
      localStatus?.execucao &&
        (localStatus.execucao.estado === "executando" || localStatus.execucao.estado === "parando")
    );

  const isCloudRunning =
    dataSourceMode === "supabase" &&
    Boolean(
      cloudRun &&
        (COLETA_ATIVA_STATES.includes(cloudRun.status) || cloudRun.status === "cancelling")
    );

  const coletaAtiva = isLocalRunning || isCloudRunning;

  const consultasPorLocal = segmentos.reduce((total, segmento) => total + (TERMOS_POR_SEGMENTO[segmento] || 0), 0);
  const totalConsultas = locais.length * consultasPorLocal;

  // Cálculo de progresso real (zerado quando não há execução registrada)
  const progresso = useMemo(() => {
    if (dataSourceMode === "local" && localStatus?.execucao) {
      return {
        concluidas: localStatus.execucao.concluidas,
        total: Math.max(0, localStatus.execucao.total),
        falhas: localStatus.execucao.falhas,
      };
    }
    if (dataSourceMode === "supabase" && cloudRun) {
      const match = /^Nacional (\d+)\/(\d+)/.exec(cloudRun.title || "");
      if (match) {
        return { concluidas: Number(match[1]), total: Number(match[2]), falhas: 0 };
      }
      return {
        concluidas: cloudRun.status === "completed" ? 1 : 0,
        total: 1,
        falhas: cloudRun.conclusion === "failure" ? 1 : 0,
      };
    }
    return { concluidas: 0, total: 0, falhas: 0 };
  }, [dataSourceMode, localStatus, cloudRun]);

  // Cobertura real por UF (0 quando não há leads reais na UF)
  const realUfMap = useMemo(() => computeUfCoverage(realLeads), [realLeads]);

  const adicionarLocal = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const digitado = localDraft.trim().replace(/\s+/g, " ");
    if (!digitado) return;
    const corrigido = corrigirLocal(digitado);
    if (corrigido !== digitado && !locais.includes(corrigido)) {
      setLocalSuggestion(corrigido);
      return;
    }
    if (!locais.includes(corrigido)) {
      setLocais([...locais, corrigido]);
    }
    setLocalDraft("");
    setLocalSuggestion("");
  };

  const aceitarSugestao = () => {
    if (localSuggestion && !locais.includes(localSuggestion)) {
      setLocais([...locais, localSuggestion]);
    }
    setLocalDraft("");
    setLocalSuggestion("");
  };

  const removerLocal = (localParaRemover: string) => {
    setLocais(locais.filter((l) => l !== localParaRemover));
  };

  const toggleSegmento = (id: string) => {
    setSegmentos((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id]
    );
  };

  const handleStartColeta = async (locaisOverride?: string[]) => {
    setErrorMsg("");
    if (dataSourceMode === "mock") {
      setErrorMsg("A coleta real não está conectada. Entre no Supabase para usar o coletor em nuvem ou inicie a API local com Gosom.");
      return;
    }
    if (dataSourceMode === "supabase" && !supabaseSession) {
      setErrorMsg("Entre com a conta autorizada no Supabase em Configurações para liberar o coletor online.");
      return;
    }
    if (coberturaNacional && dataSourceMode !== "supabase") {
      setErrorMsg("A cobertura nacional está disponível pelo GitHub Actions, com Supabase conectado.");
      return;
    }
    if (dataSourceMode === "local") {
      setIsBusy(true);
      try {
        const res = await startLocalCollection({
          locais: locaisOverride ?? locais,
          segmentos,
          profundidade,
          emails: buscarEmails,
        });
        setStatusMsg(`Execução local #${res.id} iniciada no Gosom Scraper...`);
        await pollLocalStatus();
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : "Falha ao iniciar coleta local.");
      } finally {
        setIsBusy(false);
      }
      return;
    }

    if (dataSourceMode === "supabase" && supabaseSession) {
      setIsBusy(true);
      try {
        if (!coberturaNacional && (locaisOverride ?? locais).length * consultasPorLocal > 20) {
          throw new Error("Esta rodada excede o limite de 20 buscas do coletor online. Reduza locais ou segmentos.");
        }
        const res = await controlCloudCollector(supabaseSession, {
          action: "start",
          ...(coberturaNacional ? { cobertura: "nacional" } : {}),
          locais: (locaisOverride ?? locais).join("\n"),
          segmentos,
          profundidade,
          emails: coberturaNacional ? false : buscarEmails,
          enriquecerSites: coberturaNacional ? false : enriquecerSites,
        });
        if (res.session !== supabaseSession) onSessionUpdate?.(res.session);
        setCloudRun(res.run);
        cloudWasActiveRef.current = true;
        setStatusMsg("Workflow disparado no GitHub Actions. Aguardando execução...");
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : "Falha ao disparar coleta em nuvem.");
      } finally {
        setIsBusy(false);
      }
      return;
    }

  };

  useEffect(() => {
    if (!collectionRequest || handledRequestRef.current === collectionRequest.id) return;
    handledRequestRef.current = collectionRequest.id;
    const localCorrigido = corrigirLocal(collectionRequest.local);
    setLocais([localCorrigido]);
    setCoberturaNacional(false);
    void handleStartColeta([localCorrigido]);
    // Uma solicitação representa uma ação única iniciada pelo modal de Nova Prospecção.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collectionRequest?.id]);

  const handleStopColeta = async () => {
    setErrorMsg("");
    if (dataSourceMode === "local") {
      setIsBusy(true);
      try {
        await stopLocalCollection();
        setStatusMsg("Parada solicitada ao processo Gosom local.");
        await pollLocalStatus();
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : "Falha ao parar coleta local.");
      } finally {
        setIsBusy(false);
      }
      return;
    }

    if (dataSourceMode === "supabase" && supabaseSession) {
      setIsBusy(true);
      try {
        const res = await controlCloudCollector(supabaseSession, { action: "stop" });
        if (res.session !== supabaseSession) onSessionUpdate?.(res.session);
        setCloudRun(res.run);
        setStatusMsg("Cancelamento enviado ao GitHub Actions.");
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : "Falha ao cancelar coleta em nuvem.");
      } finally {
        setIsBusy(false);
      }
      return;
    }

  };

  return (
    <div className="space-y-6 animate-fade-in">
      <ProspectSearch dataSourceMode={dataSourceMode} session={supabaseSession} onSessionUpdate={onSessionUpdate} realLeads={realLeads} />
      <details open={coletaAtiva || Boolean(collectionRequest) ? true : undefined} className={ui.card} onToggle={event => {
        if (event.currentTarget.open) onRefreshLeads?.();
      }}>
        <summary className="px-4 py-5 sm:px-6 cursor-pointer font-bold text-foreground">Coleta no Google Maps · configurar e acompanhar {coletaAtiva ? "(em andamento)" : ""}</summary>
        <div className="p-4 sm:p-6 space-y-6 border-t border-border">
      {/* Cabeçalho da Seção */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className={cn(ui.pageTitle, "flex items-center gap-2.5")}>
            <Search className="text-brand" size={24} />
            <span>Central de Prospecção & Web Scraping</span>
          </h2>
          <p className={ui.pageSubtitle}>
            Configure coletas automatizadas via Google Maps Scraper (Gosom) com enriquecimento via Playwright.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {coletaAtiva ? (
            <button
              onClick={() => void handleStopColeta()}
              disabled={isBusy}
              className={cn(
                ui.btnSecondary,
                "h-12 px-6 text-sm font-bold bg-foreground text-background hover:bg-foreground/90"
              )}
            >
              <Square size={16} /> {isBusy ? "Parando..." : "Parar Coleta"}
            </button>
          ) : (
            <button
              onClick={() => void handleStartColeta()}
              disabled={isBusy || (!coberturaNacional && locais.length === 0) || segmentos.length === 0 || dataSourceMode === "mock" || (dataSourceMode === "supabase" && !supabaseSession) || (coberturaNacional && dataSourceMode !== "supabase") || (!coberturaNacional && dataSourceMode === "supabase" && totalConsultas > 20)}
              className={cn(ui.btnBrand, "h-12 px-8 text-sm")}
            >
              <Play size={17} /> {isBusy ? "Iniciando..." : "Iniciar Coleta"}
            </button>
          )}
        </div>
      </div>

      {errorMsg && (
        <div
          role="alert"
          className="p-4 rounded-2xl bg-surface border border-border flex items-center gap-2.5 text-xs text-foreground font-semibold"
        >
          <AlertCircle size={16} className="text-brand shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Monitor de Execução */}
      <div className={cn(ui.cardInteractive, "p-6")}>
        <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-border gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            <span
              className={cn(
                "w-3 h-3 rounded-full",
                coletaAtiva ? "bg-primary animate-ping" : "bg-muted-foreground"
              )}
            />
            <span className="font-bold text-base text-foreground">Status da Operação</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-primary-soft text-brand font-semibold">
              {coletaAtiva
                ? "Em Execução"
                : dataSourceMode === "local"
                  ? "Motor Local (SQLite + Gosom)"
                  : dataSourceMode === "supabase"
                    ? supabaseSession ? "Motor Cloud (GitHub Actions)" : "Conecte o Supabase"
                    : "Backend não conectado"}
            </span>
            {cloudRun?.url && (
              <a
                href={cloudRun.url}
                target="_blank"
                rel="noreferrer"
                className="text-xs font-semibold text-brand hover:underline inline-flex items-center gap-1"
              >
                Acompanhar no GitHub Actions <ExternalLink size={12} />
              </a>
            )}
          </div>

          <span className="text-xs text-muted-foreground font-mono tabular-nums">
            {progresso.concluidas} de {progresso.total} buscas concluídas · {progresso.falhas} falhas
            {localStatus?.sync_pendente ? ` · ${localStatus.sync_pendente} sync pendente` : ""}
          </span>
        </div>

        <div className="mt-4">
          <div className="w-full bg-muted h-3 rounded-full overflow-hidden border border-border">
            <div
              className="h-full bg-gradient-to-r from-primary to-primary-strong transition-all duration-500 rounded-full"
              style={{
                width: `${
                  progresso.total > 0
                    ? Math.min(100, Math.round((progresso.concluidas / progresso.total) * 100))
                    : 0
                }%`,
              }}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-2 flex items-center gap-2">
            <Zap size={14} className="text-brand shrink-0" />
            <span>
              {dataSourceMode === "mock"
                ? "Modo demonstração: conecte o Supabase ou inicie a API local com Gosom para executar buscas reais."
                : dataSourceMode === "supabase" && !supabaseSession
                  ? "Entre com a conta autorizada no Supabase em Configurações para liberar o coletor online."
                  : statusMsg}
            </span>
          </p>
        </div>
      </div>

      {/* Painel de Configuração da Coleta */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Coluna 1 & 2: Locais e Parâmetros */}
        <div className={cn(ui.card, "lg:col-span-2 p-6 space-y-5")}>
          <div className="flex items-center justify-between pb-3 border-b border-border">
            <h3 className={ui.cardTitle}>
              <MapPin size={18} className="text-brand" /> Locais para Prospecção
            </h3>
            <span className="text-xs text-muted-foreground">
              {dataSourceMode === "supabase" ? "Até 20 buscas por rodada Cloud" : "Busca local enviada ao Gosom"}
            </span>
          </div>

          {/* Campo de Pesquisa de Local */}
          <form onSubmit={adicionarLocal} className="relative flex gap-2">
            <div className="relative flex-1">
              <Search
                size={17}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
              />
              <input
                type="text"
                value={localDraft}
                onChange={(e) => {
                  setLocalDraft(e.target.value);
                  setLocalSuggestion("");
                }}
                placeholder="Ex: Campinas, SP ou Curitiba, PR"
                className={cn(ui.input, "pl-10 rounded-xl")}
              />
            </div>
            <button type="submit" className={cn(ui.btnPrimary, "px-5 h-11 text-xs")}>
              Adicionar
            </button>
          </form>

          {/* Sugestão de Local */}
          {localSuggestion && (
            <div className="p-3 rounded-xl bg-primary-soft border border-primary/25 text-xs text-muted-foreground flex items-center gap-2">
              <span>Você quis dizer</span>
              <button
                type="button"
                onClick={aceitarSugestao}
                className="text-brand font-bold underline cursor-pointer"
              >
                {localSuggestion}
              </button>
              <span>?</span>
            </div>
          )}

          {/* Chips de Locais Adicionados */}
          <div className="flex flex-wrap gap-2 pt-2">
            {locais.map((local) => (
              <span
                key={local}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-primary-soft text-brand border border-primary/25"
              >
                <span>{local}</span>
                <button
                  type="button"
                  onClick={() => removerLocal(local)}
                  className="hover:text-foreground p-0.5"
                  aria-label={`Remover ${local}`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
          {!coberturaNacional && (
            <p className={cn("text-xs", dataSourceMode === "supabase" && totalConsultas > 20 ? "text-destructive" : "text-muted-foreground")}>
              {totalConsultas} {totalConsultas === 1 ? "busca" : "buscas"} nesta execução.
              {dataSourceMode === "supabase" && totalConsultas > 20 ? " Reduza locais ou segmentos para ficar no limite de 20." : ""}
            </p>
          )}

          {/* Opção Cobertura Nacional */}
          <div className="pt-4 border-t border-border">
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={coberturaNacional}
                onChange={(e) => setCoberturaNacional(e.target.checked)}
                disabled={dataSourceMode !== "supabase" || !supabaseSession}
                className={ui.checkbox}
              />
              <div>
                <span className="font-semibold text-sm text-foreground block">
                  Cobertura Nacional Completa
                </span>
                <span className="text-xs text-muted-foreground block">
                  {dataSourceMode === "supabase" && supabaseSession
                    ? "O GitHub Actions percorre a fila nacional em rodadas de até 20 buscas."
                    : "Disponível com Supabase conectado; usa a fila real do GitHub Actions."}
                </span>
              </div>
            </label>
          </div>
        </div>

        {/* Coluna 3: Filtros Avançados & Segmentos */}
        <div className={cn(ui.card, "p-6 space-y-5")}>
          <div className="pb-3 border-b border-border">
            <h3 className={ui.cardTitle}>
              <Sliders size={18} className="text-brand" /> Filtros de Coleta
            </h3>
          </div>

          {/* Segmentos Farmacêuticos */}
          <div className="space-y-2.5">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
              Segmentos Alvo
            </span>
            {[
              { id: "varejo", label: "Farmácia de Varejo / Drogaria" },
              { id: "manipulacao", label: "Farmácia de Manipulação" },
              { id: "homeopatia", label: "Farmácia Homeopática" },
              { id: "veterinaria", label: "Farmácia Veterinária" },
              { id: "distribuidoras", label: "Distribuidoras de Medicamentos" },
            ].map((seg) => (
              <label key={seg.id} className="flex items-center gap-2.5 text-xs text-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={segmentos.includes(seg.id)}
                  onChange={() => toggleSegmento(seg.id)}
                  className={ui.checkbox}
                />
                <span>{seg.label}</span>
              </label>
            ))}
          </div>

          {/* Profundidade */}
          <div className="pt-3 border-t border-border">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-2">
              Profundidade da Busca ({profundidade} páginas)
            </label>
            <input
              type="range"
              min={1}
              max={10}
              value={profundidade}
              onChange={(e) => setProfundidade(Number(e.target.value))}
              className="w-full accent-primary cursor-pointer"
            />
          </div>

          {/* Enriquecimento Playwright */}
          <div className="pt-3 border-t border-border space-y-2">
            <label className="flex items-center gap-2.5 text-xs text-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={enriquecerSites && dataSourceMode === "supabase" && !coberturaNacional}
                onChange={(e) => setEnriquecerSites(e.target.checked)}
                disabled={dataSourceMode !== "supabase" || !supabaseSession || coberturaNacional}
                className={ui.checkbox}
              />
              <span className="flex items-center gap-1.5 font-medium">
                <Globe size={13} className="text-brand" /> Enriquecer Sites (Playwright)
              </span>
            </label>

            <label className="flex items-center gap-2.5 text-xs text-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={buscarEmails && !coberturaNacional}
                onChange={(e) => setBuscarEmails(e.target.checked)}
                disabled={coberturaNacional}
                className={ui.checkbox}
              />
              <span className="flex items-center gap-1.5 font-medium">
                <Mail size={13} className="text-brand" /> Buscar E-mails de Contato
              </span>
            </label>
          </div>
        </div>
      </div>

      {/* Grade de Cobertura por UF */}
      <div className={cn(ui.card, "p-6")} role="region" aria-label="Cobertura por UF">
        <div className="flex items-center justify-between pb-4 border-b border-border mb-4">
          <h3 className="font-bold text-base text-foreground">
            Cobertura Territorial por Estado (27 UFs)
          </h3>
          <span className="text-xs text-brand font-semibold">
            {`${Object.keys(realUfMap).length} de 27 UFs na base ativa`}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-9 gap-2.5">
          {UFS.map((sigla) => {
            const realData = realUfMap[sigla];
            const count = realData?.total || 0;
            const dateLabel = formatUltimaColeta(realData?.ultima);

            return (
              <div
                key={sigla}
                className="p-3 rounded-xl bg-surface border border-border text-center hover:border-primary/50 transition-colors"
              >
                <span className="font-bold text-sm text-foreground block">{sigla}</span>
                <span className="text-[11px] text-brand font-semibold block mt-0.5 tabular-nums">
                  {count === 1 ? "1 lead" : `${count} leads`}
                </span>
                <span className="text-[10px] text-muted-foreground block mt-1 truncate">
                  {dateLabel}
                </span>
              </div>
            );
          })}
        </div>
      </div>
        </div>
      </details>
    </div>
  );
}
