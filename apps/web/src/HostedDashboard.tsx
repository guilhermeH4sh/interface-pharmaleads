import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Activity, ChevronRight, Database, Download, Filter, RefreshCw, Search, Users, X } from "lucide-react";
import type { Lead } from "./lib/crm";
import { corrigirLocal } from "./lib/locations";
import logo from "./assets/centrus-logo-original.png";
import "./crm.css";

// A publishable key is designed for browser use. Row Level Security protects the table.
const SUPABASE_URL = "https://qxsdcrywsjkrpcbfgbxb.supabase.co";
const PUBLISHABLE_KEY = "sb_publishable_9AdBAjeEHFysAVpC7VCLMw_cDgQ4Fl0";
const AUTHORIZED_USER_ID = "677ed1e4-3e73-4f2c-951f-e77386f305da";
const SESSION_KEY = "pharmaleads-supabase-session";
const COLUMNS = "chave,nome,segmento,categoria,endereco,local_busca,telefone,telefone_normalizado,celular,whatsapp_link,site,emails,situacao,avaliacao,qtd_avaliacoes,latitude,longitude,link,ultima_coleta";
const UFS = ["AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO", "MA", "MG", "MS", "MT", "PA", "PB", "PE", "PI", "PR", "RJ", "RN", "RO", "RR", "RS", "SC", "SE", "SP", "TO"];
const COLETA_ATIVA = ["queued", "in_progress", "waiting", "pending", "requested"];

type Session = { access_token: string; refresh_token: string; expires_at: number };
type AuthResponse = { access_token?: string; refresh_token?: string; expires_in?: number; user?: { id?: string }; error_description?: string; msg?: string };
type CollectorRun = { id: number; status: string; conclusion: string | null; url: string; created_at: string; title: string };
class AccessError extends Error {}

function savedSession(): Session | null {
  try {
    const value = sessionStorage.getItem(SESSION_KEY);
    if (!value) return null;
    const parsed = JSON.parse(value) as Session;
    return parsed.access_token && parsed.refresh_token && Number.isFinite(parsed.expires_at) ? parsed : null;
  } catch { return null; }
}

async function authenticate(grant: "password" | "refresh_token", fields: Record<string, string>): Promise<Session> {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=${grant}`, {
    method: "POST",
    headers: { apikey: PUBLISHABLE_KEY, "Content-Type": "application/json" },
    body: JSON.stringify(fields),
  });
  const body = await response.json() as AuthResponse;
  if (!response.ok || !body.access_token || !body.refresh_token || !body.expires_in) {
    throw new AccessError(grant === "password" ? "Login não autorizado. Confira e-mail e senha da conta Supabase." : "Sessão expirada. Entre novamente.");
  }
  if (body.user?.id !== AUTHORIZED_USER_ID) {
    sessionStorage.removeItem(SESSION_KEY);
    throw new AccessError("Esta conta não é o usuário autorizado para public.pharmaleads. Entre com o usuário cadastrado em Supabase Authentication > Users.");
  }
  const session = { access_token: body.access_token, refresh_token: body.refresh_token, expires_at: Date.now() + body.expires_in * 1000 };
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

async function validSession(session: Session): Promise<Session> {
  return session.expires_at > Date.now() + 60_000 ? session : authenticate("refresh_token", { refresh_token: session.refresh_token });
}

async function fetchLeads(session: Session): Promise<{ session: Session; rows: Lead[] }> {
  const active = await validSession(session);
  const identity = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: PUBLISHABLE_KEY, Authorization: `Bearer ${active.access_token}` },
  });
  if (!identity.ok) throw new AccessError("Sessão inválida ou expirada. Entre novamente.");
  const user = await identity.json() as { id?: string };
  if (user.id !== AUTHORIZED_USER_ID) throw new AccessError("Esta conta não tem acesso aos leads. Entre com o usuário autorizado em Supabase Authentication > Users.");
  const rows: Lead[] = [];
  let offset = 0;
  while (true) {
    const query = new URLSearchParams({ select: COLUMNS, order: "chave.asc", limit: "500", offset: String(offset) });
    const response = await fetch(`${SUPABASE_URL}/rest/v1/pharmaleads?${query}`, {
      headers: { apikey: PUBLISHABLE_KEY, Authorization: `Bearer ${active.access_token}`, Prefer: "count=exact" },
    });
    if (response.status === 401 || response.status === 403) throw new AccessError("A conta não tem acesso à tabela pharmaleads. Verifique as permissões no Supabase.");
    if (!response.ok) throw new Error(`Consulta ao Supabase falhou (HTTP ${response.status}).`);
    const batch = await response.json() as Lead[];
    rows.push(...batch);
    offset += batch.length;
    const total = Number(response.headers.get("content-range")?.split("/")[1]);
    if (!batch.length || (Number.isFinite(total) && offset >= total) || (!Number.isFinite(total) && batch.length < 500)) break;
  }
  if (!rows.length) throw new Error("O Supabase retornou zero leads para esta conta. Verifique as políticas RLS da tabela public.pharmaleads.");
  return { session: active, rows };
}

const display = (value: string | number | null | undefined) => String(value ?? "").trim() || "Não informado";
const situacao = (value: string) => ({ ativa_ou_desconhecida: "Ativa ou desconhecida", fechada_temporariamente: "Fechada temporariamente", fechada_permanentemente: "Fechada permanentemente", fechada: "Fechada" }[value] || display(value));
const dataCobertura = (valor: string) => {
  if (!valor) return "Sem coleta";
  const data = new Date(valor);
  return Number.isNaN(data.getTime()) ? "Sem coleta" : data.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
};
const lerCobertura = (title: string) => {
  const match = /^Nacional (\d+)\/(\d+)(?: · (.*))?$/.exec(title || "");
  return match ? { rodada: Number(match[1]), total: Number(match[2]), resumo: match[3] || "" } : null;
};
const ufOf = (row: Lead) => /(?:,|\s)([A-Z]{2})(?:\b|$)/.exec(row.local_busca)?.[1] || /- ([A-Z]{2})(?:,|$)/.exec(row.endereco)?.[1] || "";
const csvCell = (value: unknown) => {
  const raw = String(value ?? "");
  const safe = /^[\s]*[=+@-]/.test(raw) ? `'${raw}` : raw;
  return `"${safe.replaceAll('"', '""')}"`;
};

export function HostedDashboard() {
  const [session, setSession] = useState<Session | null>(savedSession);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rows, setRows] = useState<Lead[]>([]);
  const [query, setQuery] = useState("");
  const [uf, setUf] = useState("");
  const [segmento, setSegmento] = useState("");
  const [stateFilter, setStateFilter] = useState("");
  const [visible, setVisible] = useState(50);
  const [selected, setSelected] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [collectionLocals, setCollectionLocals] = useState("");
  const [localDraft, setLocalDraft] = useState("");
  const [localSuggestion, setLocalSuggestion] = useState("");
  const [collectionSegments, setCollectionSegments] = useState<string[]>(["varejo", "manipulacao"]);
  const [collectionDepth, setCollectionDepth] = useState(1);
  const [collectionEmails, setCollectionEmails] = useState(false);
  const [collectionEnrichment, setCollectionEnrichment] = useState(false);
  const [collectionNational, setCollectionNational] = useState(false);
  const [collectionRun, setCollectionRun] = useState<CollectorRun | null>(null);
  const [collectionError, setCollectionError] = useState("");
  const [collectionBusy, setCollectionBusy] = useState(false);
  const [collectorReady, setCollectorReady] = useState(false);
  const lastCompleted = useRef(0);
  const awaitingRun = useRef(false);
  const stoppingRef = useRef(false);
  const stoppingSince = useRef(0);
  const actionGen = useRef(0);
  const filaLocal = (): CollectorRun => ({ id: 0, status: "queued", conclusion: null, url: "https://github.com/guilhermeH4sh/interface-pharmaleads/actions", created_at: new Date().toISOString(), title: "Na fila" });

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    queueMicrotask(() => { if (!cancelled) setLoading(true); });
    fetchLeads(session).then(result => {
      if (cancelled) return;
      setSession(result.session);
      setRows(result.rows);
      setError("");
    }).catch(reason => {
      if (cancelled) return;
      setError(reason instanceof Error ? reason.message : "Não foi possível consultar os leads.");
      if (reason instanceof AccessError) { sessionStorage.removeItem(SESSION_KEY); setSession(null); }
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // A nova sessão gerada pelo refresh não deve repetir a consulta.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revision, Boolean(session)]);

  const filtered = useMemo(() => rows.filter(row => {
    const term = query.trim().toLocaleLowerCase("pt-BR");
    return (!term || `${row.nome} ${row.categoria} ${row.endereco} ${row.telefone} ${row.local_busca}`.toLocaleLowerCase("pt-BR").includes(term))
      && (!uf || ufOf(row) === uf)
      && (!segmento || row.segmento === segmento)
      && (!stateFilter || row.situacao === stateFilter);
  }), [rows, query, uf, segmento, stateFilter]);
  const page = filtered.slice(0, visible);
  const states = useMemo(() => [...new Set(rows.map(ufOf).filter(Boolean))].sort(), [rows]);
  const coberturaUfs = useMemo(() => UFS.map(sigla => {
    const doEstado = rows.filter(row => ufOf(row) === sigla);
    const ultima = doEstado.reduce((maior, row) => (row.ultima_coleta || "") > maior ? row.ultima_coleta || "" : maior, "");
    return { sigla, total: doEstado.length, ultima };
  }), [rows]);
  const refresh = useCallback(() => { setRevision(value => value + 1); }, []);
  const parando = collectionRun?.status === "cancelling";
  const coletaAtiva = parando || !!(collectionRun && COLETA_ATIVA.includes(collectionRun.status));
  const coberturaAtual = lerCobertura(collectionRun?.title || "");

  const refreshCollector = useCallback(async (override?: Session) => {
    const current = override || session;
    if (!current) return;
    try {
      const active = await validSession(current);
      if (active !== current) setSession(active);
      const response = await fetch("/api/collector", { headers: { Authorization: `Bearer ${active.access_token}` } });
      const body = await response.json() as { run?: CollectorRun | null; error?: string };
      if (!response.ok) throw new Error(body.error || `Coleta indisponível (HTTP ${response.status}).`);
      const run = body.run || null;
      const ativa = !!(run && COLETA_ATIVA.includes(run.status));
      const paradaExpirou = stoppingRef.current && stoppingSince.current > 0 && Date.now() - stoppingSince.current > 45_000;
      if (stoppingRef.current) {
        setCollectionError("");
        setCollectorReady(true);
        if (ativa && !paradaExpirou) return;
        stoppingRef.current = false;
        awaitingRun.current = false;
        setCollectionRun(run?.status === "completed" ? run : { ...(run || filaLocal()), status: "completed", conclusion: "cancelled" });
        if (run?.status === "completed" && lastCompleted.current !== run.id) {
          lastCompleted.current = run.id;
          refresh();
        }
        return;
      }
      if (awaitingRun.current && !ativa && !(run?.status === "completed" && run.id && run.id !== lastCompleted.current)) {
        setCollectionError("");
        setCollectorReady(true);
        return;
      }
      awaitingRun.current = ativa;
      setCollectionRun(run);
      setCollectionError("");
      setCollectorReady(true);
      if (run?.status === "completed" && lastCompleted.current !== run.id) {
        lastCompleted.current = run.id;
        refresh();
      }
    } catch (reason) {
      setCollectorReady(false);
      setCollectionError(reason instanceof Error ? reason.message : "Não foi possível consultar a coleta online.");
    }
  }, [session, refresh]);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    queueMicrotask(() => { if (!cancelled) void refreshCollector(); });
    const timer = window.setInterval(() => void refreshCollector(), coletaAtiva ? 3000 : 10000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [session, refreshCollector, coletaAtiva]);

  const collectionAction = async (action: "start" | "stop") => {
    if (!session) return;
    const gen = ++actionGen.current;
    const anterior = collectionRun;
    if (action === "start") {
      stoppingRef.current = false;
      awaitingRun.current = true;
      setCollectionRun(filaLocal());
    } else {
      stoppingRef.current = true;
      stoppingSince.current = Date.now();
      awaitingRun.current = true;
      setCollectionRun(current => ({ ...(current || filaLocal()), status: "cancelling", conclusion: null }));
    }
    setCollectionBusy(true); setCollectionError("");
    try {
      const active = await validSession(session);
      if (active !== session) setSession(active);
      const response = await fetch("/api/collector", {
        method: "POST",
        headers: { Authorization: `Bearer ${active.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...(collectionNational ? { cobertura: "nacional" } : {}), locais: collectionLocals, segmentos: collectionSegments, profundidade: collectionDepth, emails: collectionNational ? false : collectionEmails, enriquecerSites: collectionNational ? false : collectionEnrichment }),
      });
      const body = await response.json() as { error?: string; run?: CollectorRun | null };
      if (gen !== actionGen.current) return;
      const runAtiva = !!(body.run && COLETA_ATIVA.includes(body.run.status));
      if (!response.ok) {
        if (runAtiva) {
          awaitingRun.current = true;
          setCollectionRun(body.run || filaLocal());
        } else if (action === "start") {
          awaitingRun.current = false;
          setCollectionRun(anterior);
        }
        throw new Error(body.error || `Falha ao ${action === "start" ? "iniciar" : "parar"} a coleta.`);
      }
      if (action === "start") {
        awaitingRun.current = true;
        setCollectionRun(body.run || filaLocal());
      } else {
        setCollectionRun(current => ({ ...(current || body.run || filaLocal()), ...(body.run || {}), status: "cancelling", conclusion: null }));
      }
      window.setTimeout(() => { if (gen === actionGen.current) void refreshCollector(active); }, 1500);
    } catch (reason) {
      if (gen !== actionGen.current) return;
      setCollectionError(reason instanceof Error ? reason.message : "Falha ao controlar a coleta.");
    } finally { if (gen === actionGen.current) setCollectionBusy(false); }
  };

  const adicionarLocal = () => {
    const digitado = localDraft.trim().replace(/\s+/g, " ");
    if (!digitado) return;
    const corrigido = corrigirLocal(digitado);
    if (corrigido !== digitado) { setLocalSuggestion(corrigido); return; }
    setCollectionLocals(current => [...new Set([...current.split(/\r?\n/).filter(Boolean), corrigido])].join("\n"));
    setLocalDraft(""); setLocalSuggestion("");
  };
  const aceitarSugestaoLocal = () => {
    if (localSuggestion) setCollectionLocals(current => [...new Set([...current.split(/\r?\n/).filter(Boolean), localSuggestion])].join("\n"));
    setLocalDraft(""); setLocalSuggestion("");
  };

  const signIn = async (event: FormEvent) => {
    event.preventDefault(); setLoading(true); setError("");
    try {
      const result = await authenticate("password", { email: email.trim(), password });
      setPassword(""); setSession(result);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Falha no login."); }
    finally { setLoading(false); }
  };
  const signOut = () => { stoppingRef.current = false; awaitingRun.current = false; sessionStorage.removeItem(SESSION_KEY); setSession(null); setRows([]); setSelected(null); setError(""); setCollectionRun(null); setCollectionError(""); setCollectorReady(false); };
  const exportCsv = () => {
    const columns: (keyof Lead)[] = ["chave", "nome", "segmento", "categoria", "endereco", "local_busca", "telefone", "site", "emails", "situacao", "avaliacao", "qtd_avaliacoes", "link"];
    const csv = "\uFEFF" + [columns.join(";"), ...filtered.map(row => columns.map(column => csvCell(row[column])).join(";"))].join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = "pharmaleads.csv"; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return <div className="app-shell">
    <header className="app-header"><div className="header-container">
      <a className="brand-section" href="#leads"><img className="brand-logo-img" src={logo} alt="Centrus AI"/><span><strong className="brand-name">Centrus <b>PharmaLeads</b></strong><small className="brand-subtitle">Inteligência Farmacêutica · B2B</small></span></a>
      <nav className="header-nav" aria-label="Navegação principal"><a className="nav-link active" href="#leads"><Users size={17}/> Leads</a>{session && <a className="nav-link" href="#coleta">Coleta</a>}</nav>
      <span className="connection-status"><span className={session && rows.length && !error ? "status-dot online" : "status-dot"}/>{session && rows.length && !error ? "Supabase conectado" : "Acesso protegido"}</span>
    </div></header>
    <main className="main-wrapper" id="leads">
      <section className="hero-section">
      <section className="page-title-row"><div><span className="eyebrow">CENTRUS PHARMALEADS</span><h1>Prospecção e Gestão de Contas Farmacêuticas</h1><p>Estabelecimentos encontrados no Google Maps.</p></div>{session && <button className="btn btn-primary" onClick={refresh} disabled={loading}><RefreshCw size={16}/> Atualizar leads</button>}</section>
      {session && (
        <section className="hero-search" aria-label="Pesquisar locais para coleta">
          <form className="location-search" onSubmit={event => { event.preventDefault(); adicionarLocal(); }}>
            <Search size={18} aria-hidden="true"/>
            <input aria-label="Pesquisar cidade, estado ou bairro" value={localDraft} onChange={event => { setLocalDraft(event.target.value); setLocalSuggestion(""); }} placeholder="Pesquisar"/>
            <button className="location-add" type="submit" aria-label="Adicionar local"><ChevronRight size={19}/></button>
          </form>
          {localSuggestion && <div className="location-suggestion">Você quis dizer <button type="button" onClick={aceitarSugestaoLocal}>{localSuggestion}</button>? <button type="button" onClick={() => { setCollectionLocals(current => [...new Set([...current.split(/\r?\n/).filter(Boolean), localDraft.trim()])].join("\n")); setLocalDraft(""); setLocalSuggestion(""); }}>Manter texto digitado</button></div>}
          {!!collectionLocals && <div className="location-chips">{collectionLocals.split(/\r?\n/).filter(Boolean).map(local => <button type="button" key={local} aria-label={`Remover ${local}`} onClick={() => setCollectionLocals(current => current.split(/\r?\n/).filter(item => item !== local).join("\n"))}>{local} <span aria-hidden="true">×</span></button>)}</div>}
          <details className="hero-filters"><summary>Filtros da coleta</summary><div className="compact-filters"><label><input type="checkbox" checked={collectionNational} onChange={event => setCollectionNational(event.target.checked)}/> Cobertura nacional</label><fieldset className="segment-options compact-segments"><legend>Segmentos</legend>{[["varejo","Varejo"],["manipulacao","Manipulação"],["homeopatia","Homeopatia"],["veterinaria","Veterinária"],["distribuidoras","Distribuidoras"]].map(([id,label]) => <label key={id}><input type="checkbox" checked={collectionSegments.includes(id)} onChange={event => setCollectionSegments(current => event.target.checked ? [...current,id] : current.filter(x => x !== id))}/>{label}</label>)}</fieldset><label>Profundidade<input aria-label="Profundidade online" type="number" min="1" max="10" value={collectionDepth} onChange={event => setCollectionDepth(Number(event.target.value))}/></label><label><input type="checkbox" checked={collectionEnrichment} onChange={event => setCollectionEnrichment(event.target.checked)}/> Enriquecer sites (mais lento)</label><label><input type="checkbox" checked={collectionEmails} onChange={event => setCollectionEmails(event.target.checked)}/> Buscar e-mails</label></div></details>
          <button className="btn btn-primary hero-start" aria-busy={collectionBusy || coletaAtiva} disabled={!collectorReady || collectionBusy || (!collectionNational && !collectionLocals.trim()) || !collectionSegments.length || coletaAtiva} onClick={() => void collectionAction("start")}>{parando ? "Parando…" : coletaAtiva ? "Coleta em andamento" : "Iniciar coleta"}</button>
        </section>
      )}
      </section>
      {!session ? <section className="leads-panel hosted-login"><div className="panel-heading"><div><span className="eyebrow">ACESSO À BASE</span><h2>Entrar com sua conta Supabase</h2><p>Use a conta que já tem permissão na tabela pharmaleads.</p></div></div><form onSubmit={event => void signIn(event)} className="hosted-login-form"><label>E-mail<input type="email" autoComplete="username" value={email} onChange={event => setEmail(event.target.value)} required/></label><label>Senha<input type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} required/></label>{error && <div className="error-message" role="alert">{error}</div>}<button className="btn btn-primary" type="submit" disabled={loading}>{loading ? "Entrando…" : "Entrar"}</button></form></section> : <>
        <section className="kpi-section" aria-label="Resumo"><article className="kpi-card highlight"><div className="kpi-header"><span>Leads no Supabase</span><Users size={19}/></div><strong className="kpi-value">{loading && !rows.length ? "…" : rows.length}</strong><p>Estabelecimentos únicos</p></article><article className="kpi-card"><div className="kpi-header"><span>Resultados filtrados</span><Search size={19}/></div><strong className="kpi-value">{filtered.length}</strong><p>Consulta na base completa</p></article><article className="kpi-card source-card"><div className="kpi-header"><span>Fonte dos dados</span><Database size={19}/></div><strong>Supabase</strong><p>public.pharmaleads</p></article></section>
        <section className="leads-panel hosted-note" id="coleta"><div className="panel-heading"><div><span className="eyebrow">COLETA ONLINE</span><h2>Iniciar busca no Google Maps</h2><p>O job roda no GitHub Actions e envia cada resultado ao Supabase.</p></div><button className="btn btn-secondary" onClick={signOut}>Sair</button></div>
          <div className="collection-body">
          {collectionError && <div className="error-message" role="alert">{collectionError}</div>}
          <div className="run-actions"><button className="btn btn-secondary" disabled={!collectorReady || !coletaAtiva || parando} onClick={() => void collectionAction("stop")}>{parando ? "Parando…" : "Parar coleta"}</button><span>Até 20 buscas por execução.</span></div>
          {collectionRun && <div className="run-progress"><strong>Última execução: {collectionRun.status === "completed" ? collectionRun.conclusion === "success" ? "Concluída" : collectionRun.conclusion === "cancelled" ? "Cancelada" : "Falhou" : collectionRun.status === "cancelling" ? "Parando" : collectionRun.status === "in_progress" ? "Em andamento" : "Na fila"}{coberturaAtual ? ` · rodada ${coberturaAtual.rodada} de ${coberturaAtual.total}` : ""}</strong>{coberturaAtual?.resumo ? <p>{coberturaAtual.resumo}</p> : null}<p><a href={collectionRun.url} target="_blank" rel="noreferrer">Acompanhar no GitHub Actions</a></p></div>}
          <div className="uf-coverage" role="region" aria-label="Cobertura por UF">{coberturaUfs.map(item => <article key={item.sigla}><strong>{item.sigla}</strong><span>{item.total === 1 ? "1 lead" : `${item.total} leads`}</span><span>{dataCobertura(item.ultima)}</span></article>)}</div>
          </div>
        </section>
        <section className="leads-panel lead-list"><div className="panel-heading"><div><span className="eyebrow">CARTEIRA DE PROSPECÇÃO</span><h2>Estabelecimentos</h2><p>Filtre os leads e abra a ficha para mais detalhes.</p></div><button className="btn btn-secondary" onClick={exportCsv} disabled={loading || !filtered.length}><Download size={16}/> Exportar CSV</button></div>
          <div className="filters"><label className="search-field"><Search size={18}/><input aria-label="Buscar estabelecimentos" value={query} onChange={event => { setQuery(event.target.value); setVisible(50); }} placeholder="Buscar por nome, endereço ou telefone"/>{query && <button aria-label="Limpar busca" onClick={() => setQuery("")}><X size={16}/></button>}</label><label className="select-field"><Filter size={17}/><select aria-label="Filtrar por UF" value={uf} onChange={event => {setUf(event.target.value);setVisible(50);}}><option value="">Todas as UFs</option>{states.map(state => <option key={state}>{state}</option>)}</select></label><label className="select-field"><select aria-label="Filtrar por segmento" value={segmento} onChange={event => {setSegmento(event.target.value);setVisible(50);}}><option value="">Todos os segmentos</option><option value="varejo">Varejo</option><option value="manipulacao">Manipulação</option></select></label><label className="select-field"><select aria-label="Filtrar por situação" value={stateFilter} onChange={event => {setStateFilter(event.target.value);setVisible(50);}}><option value="">Todas as situações</option><option value="ativa_ou_desconhecida">Ativa ou desconhecida</option><option value="fechada_temporariamente">Fechada temporariamente</option><option value="fechada_permanentemente">Fechada permanentemente</option></select></label></div>
          {error && <div className="error-message" role="alert"><Activity size={18}/>{error}</div>}
          {loading && !rows.length ? <div className="empty">Consultando estabelecimentos…</div> : !error && !page.length ? <div className="empty">Nenhum estabelecimento encontrado.</div> : <div className="table-scroll"><table><thead><tr><th>Estabelecimento</th><th>Local da busca</th><th>Telefone</th><th>Segmento</th><th>Situação</th><th><span className="sr-only">Detalhes</span></th></tr></thead><tbody>{page.map(row => <tr key={row.chave} onClick={() => setSelected(row)} tabIndex={0} onKeyDown={event => {if(event.key === "Enter" || event.key === " "){event.preventDefault();setSelected(row);}}}><td><strong>{display(row.nome)}</strong><small>{display(row.categoria)}</small></td><td>{display(row.local_busca)}</td><td className="mono">{display(row.telefone)}</td><td>{display(row.segmento)}</td><td><span className="status-badge">{situacao(row.situacao)}</span></td><td><ChevronRight size={17}/></td></tr>)}</tbody></table></div>}
          {page.length < filtered.length && <div className="load-more"><button className="btn btn-secondary" onClick={() => setVisible(value => value + 50)}>Carregar mais</button></div>}
        </section><footer className="page-footer"><span>Fonte: Google Maps · Banco Supabase</span><span>{page.length} de {filtered.length} registros exibidos</span></footer>
      </>}
    </main>
    {selected && <div className="overlay" onMouseDown={event => {if(event.target === event.currentTarget)setSelected(null);}}><section className="drawer" role="dialog" aria-modal="true" aria-labelledby="detail-title"><header><div><span className="eyebrow">ESTABELECIMENTO</span><h2 id="detail-title">{display(selected.nome)}</h2><p>{display(selected.categoria)}</p></div><button aria-label="Fechar ficha" onClick={() => setSelected(null)}><X/></button></header><dl>{[["Local da busca",selected.local_busca],["Segmento",selected.segmento],["Endereço",selected.endereco],["Telefone",selected.telefone],["Site",selected.site],["E-mail",selected.emails],["Situação",situacao(selected.situacao)],["Avaliação",selected.avaliacao],["Quantidade de avaliações",selected.qtd_avaliacoes]].map(([label,value]) => <div key={label}><dt>{label}</dt><dd>{display(value)}</dd></div>)}</dl><div className="drawer-links">{selected.link && <a href={selected.link} target="_blank" rel="noreferrer">Abrir no Maps</a>}{selected.whatsapp_link && <a href={selected.whatsapp_link} target="_blank" rel="noreferrer">Abrir WhatsApp</a>}</div></section></div>}
  </div>;
}
