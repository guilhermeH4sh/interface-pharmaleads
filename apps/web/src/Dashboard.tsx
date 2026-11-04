import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Activity, Building2, ChevronRight, Database, Download, Filter, Play, RefreshCw, Search, Square, Users, X } from "lucide-react";
import { request, type Lead, type Page, type Segmento, type Status } from "./lib/crm";
import { corrigirLocal } from "./lib/locations";
import logo from "./assets/centrus-logo-original.png";
import "./crm.css";

const states = "AC AL AM AP BA CE DF ES GO MA MG MS MT PA PB PE PI PR RJ RN RO RR RS SC SE SP TO".split(" ");
const display = (value: string | number | null | undefined) => String(value ?? "").trim() || "Não informado";
const situacao = (value: string) => ({ ativa_ou_desconhecida: "Ativa ou desconhecida", fechada_temporariamente: "Fechada temporariamente", fechada_permanentemente: "Fechada permanentemente", fechada: "Fechada" }[value] || display(value));

export function Dashboard() {
  const [page, setPage] = useState<Page>({ items: [], total: 0, next_offset: null });
  const [status, setStatus] = useState<Status | null>(null);
  const [segmentos, setSegmentos] = useState<Segmento[]>([]);
  const [selectedSegments, setSelectedSegments] = useState<string[]>(["varejo", "manipulacao"]);
  const [locais, setLocais] = useState("");
  const [localDraft, setLocalDraft] = useState("");
  const [localSuggestion, setLocalSuggestion] = useState("");
  const [depth, setDepth] = useState(1);
  const [emails, setEmails] = useState(false);
  const [query, setQuery] = useState("");
  const [uf, setUf] = useState("");
  const [segmento, setSegmento] = useState("");
  const [stateFilter, setStateFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [selected, setSelected] = useState<Lead | null>(null);
  const [version, setVersion] = useState(0);
  const ultimaColeta = useRef("");
  const filters = useMemo(() => { const p = new URLSearchParams(); if(query.trim()) p.set("q",query.trim()); if(uf) p.set("uf",uf); if(segmento) p.set("segmento",segmento); if(stateFilter) p.set("situacao",stateFilter); return p.toString(); },[query,uf,segmento,stateFilter]);
  const refreshStatus = useCallback(() => request<Status>("/api/status").then(setStatus).catch(() => setStatus(null)), []);

  useEffect(() => { request<{segmentos: Segmento[]}>("/api/config").then(x => setSegmentos(x.segmentos)).catch(() => setActionError("Não foi possível consultar a API local.")); void refreshStatus(); const timer=window.setInterval(() => void refreshStatus(),2500); return () => window.clearInterval(timer); },[refreshStatus]);
  useEffect(() => { const controller=new AbortController(); const timer=window.setTimeout(() => { setLoading(true); request<Page>(`/api/leads?${filters}`,{signal:controller.signal}).then(result => { if (!controller.signal.aborted) {setPage(result);setError("");} }).catch(reason => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Falha ao consultar os leads."); }).finally(() => {if(!controller.signal.aborted)setLoading(false);}); }, 250); return () => {controller.abort();window.clearTimeout(timer);}; },[filters,version]);
  const loadMore = async () => { if(page.next_offset===null || loading) return; setLoading(true); try {const next=await request<Page>(`/api/leads?${filters}&offset=${page.next_offset}`);setPage(current=>({...next,items:[...current.items,...next.items]}));} catch(reason) {setError(reason instanceof Error ? reason.message : "Falha ao carregar registros.");} finally {setLoading(false);} };
  const running = status?.execucao?.estado === "executando" || status?.execucao?.estado === "parando";
  const start = async () => {setBusy(true);setActionError("");try {await request("/api/coletas",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({locais:locais.split(/\r?\n/).map(x=>x.trim()).filter(Boolean),segmentos:selectedSegments,profundidade:depth,emails})});await refreshStatus();} catch(reason) {setActionError(reason instanceof Error ? reason.message : "Falha ao iniciar coleta.");} finally {setBusy(false);} };
  const adicionarLocal = () => { const digitado = localDraft.trim().replace(/\s+/g, " "); if (!digitado) return; const corrigido = corrigirLocal(digitado); if (corrigido !== digitado) {setLocalSuggestion(corrigido);return;} setLocais(current => [...new Set([...current.split(/\r?\n/).filter(Boolean), corrigido])].join("\n"));setLocalDraft("");setLocalSuggestion(""); };
  const stop = async () => {setBusy(true);setActionError("");try {await request("/api/coletas/parar",{method:"POST"});await refreshStatus();} catch(reason) {setActionError(reason instanceof Error ? reason.message : "Falha ao parar coleta.");} finally {setBusy(false);} };
  const run=status?.execucao;
  useEffect(() => {
    if (!run || !run.concluidas) return;
    const marcador = `${run.id}:${run.concluidas}`;
    if (ultimaColeta.current !== marcador) {
      ultimaColeta.current = marcador;
      setVersion(n => n + 1);
    }
  }, [run]);
  const progress=run?.total ? Math.round(((run.concluidas+run.falhas)/run.total)*100) : 0;
  const refresh = () => { setVersion(n=>n+1); void refreshStatus(); };

  return <div className="app-shell">
    <header className="app-header"><div className="header-container">
      <a className="brand-section" href="#leads"><img className="brand-logo-img" src={logo} alt="Centrus AI"/><span><strong className="brand-name">Centrus <b>PharmaLeads</b></strong><small className="brand-subtitle">Inteligência Farmacêutica · B2B</small></span></a>
      <nav className="header-nav" aria-label="Navegação principal"><a className="nav-link active" href="#leads"><Users size={17}/> Leads</a><a className="nav-link" href="#coleta"><Activity size={17}/> Coleta</a></nav>
      <span className="connection-status"><span className={status ? "status-dot online" : "status-dot"}/>{status ? "API local conectada" : "API local indisponível"}</span>
    </div></header>
    <main className="main-wrapper" id="leads">
      <section className="hero-section">
      <section className="page-title-row"><div><span className="eyebrow">CENTRUS PHARMALEADS</span><h1>Prospecção e Gestão de Contas Farmacêuticas</h1><p>Configure coletas e consulte estabelecimentos encontrados no Google Maps.</p></div><button className="btn btn-primary" onClick={refresh} disabled={loading}><RefreshCw size={16}/> Atualizar leads</button></section>
      <section className="hero-search" aria-label="Pesquisar locais para coleta">
        <form className="location-search" onSubmit={event => {event.preventDefault();adicionarLocal();}}><Search size={18} aria-hidden="true"/><input aria-label="Pesquisar cidade, estado ou bairro" value={localDraft} onChange={event => {setLocalDraft(event.target.value);setLocalSuggestion("");}} placeholder="Pesquisar" disabled={!!running}/><button className="location-add" type="submit" aria-label="Adicionar local" disabled={!!running}><ChevronRight size={19}/></button></form>
        {localSuggestion && <div className="location-suggestion">Você quis dizer <button type="button" onClick={() => {setLocais(current => [...new Set([...current.split(/\r?\n/).filter(Boolean), localSuggestion])].join("\n"));setLocalDraft("");setLocalSuggestion("");}}>{localSuggestion}</button>? <button type="button" onClick={() => {setLocais(current => [...new Set([...current.split(/\r?\n/).filter(Boolean), localDraft.trim()])].join("\n"));setLocalDraft("");setLocalSuggestion("");}}>Manter texto digitado</button></div>}
        {!!locais && <div className="location-chips">{locais.split(/\r?\n/).filter(Boolean).map(local => <button type="button" key={local} aria-label={`Remover ${local}`} onClick={() => setLocais(current => current.split(/\r?\n/).filter(item => item !== local).join("\n"))} disabled={!!running}>{local} <span aria-hidden="true">×</span></button>)}</div>}
        <details className="hero-filters"><summary>Filtros da coleta</summary><div className="compact-filters"><fieldset className="segment-options" disabled={!!running}><legend>Segmentos</legend>{segmentos.map(item=><label key={item.id}><input type="checkbox" checked={selectedSegments.includes(item.id)} onChange={e=>setSelectedSegments(current=>e.target.checked?[...current,item.id]:current.filter(x=>x!==item.id))}/>{item.descricao}</label>)}</fieldset><label>Profundidade <input aria-label="Profundidade" type="number" min="1" max="10" value={depth} disabled={!!running} onChange={e=>setDepth(Number(e.target.value))}/></label><label><input type="checkbox" checked={emails} disabled={!!running} onChange={e=>setEmails(e.target.checked)}/> Buscar e-mails nos sites</label></div></details>
        <button className="btn btn-primary hero-start" onClick={()=>void start()} disabled={busy || !!running || !locais.trim() || !selectedSegments.length}><Play size={16}/> Iniciar coleta</button>
      </section>
      </section>
      <section className="kpi-section" aria-label="Resumo"><article className="kpi-card highlight"><div className="kpi-header"><span>Leads no banco</span><Users size={19}/></div><strong className="kpi-value">{status?.total_leads ?? "—"}</strong><p>Estabelecimentos únicos</p></article><article className="kpi-card"><div className="kpi-header"><span>Resultados filtrados</span><Search size={19}/></div><strong className="kpi-value">{error ? "—" : page.total}</strong><p>Consulta no banco completo</p></article><article className="kpi-card"><div className="kpi-header"><span>Última coleta</span><Building2 size={19}/></div><strong className="kpi-value">{run ? `${run.concluidas}/${run.total}` : "—"}</strong><p>{run ? `${run.falhas} com falha` : "Nenhuma execução iniciada"}</p></article><article className="kpi-card source-card"><div className="kpi-header"><span>Fonte dos dados</span><Database size={19}/></div><strong>SQLite local</strong><p>{status?.sync_pendente ? `${status.sync_pendente} aguardando Supabase` : "Google Maps via Gosom"}</p></article></section>
      <section className="leads-panel collection-panel" id="coleta"><div className="panel-heading"><div><span className="eyebrow">NOVA COLETA</span><h2>Status da coleta</h2></div><span className="count-badge">{run ? ({executando:"Em andamento",parando:"Parando",parada:"Parada",concluida:"Concluída",concluida_com_falhas:"Concluída com falhas",falhou:"Falhou",interrompida:"Interrompida"}[run.estado] || run.estado) : "Aguardando"}</span></div>
        <div className="collection-body">
        {actionError && <div className="error-message" role="alert">{actionError}</div>}
        <div className="run-actions"><button className="btn btn-secondary" onClick={()=>void stop()} disabled={busy || !running || run?.estado === "parando"}><Square size={15}/> Parar coleta</button><span>Até 100 locais por execução</span></div>
        {run && <div className="run-progress"><div><strong>Progresso da execução #{run.id}</strong><span>{run.concluidas + run.falhas} de {run.total} buscas · {run.falhas} falhas</span></div><progress max={100} value={progress} aria-label="Progresso da coleta"/><p>{status?.consulta_atual ? `Buscando: ${status.consulta_atual}` : run.erro ? `Último erro: ${run.erro}` : "Os resultados são salvos após cada busca concluída."}</p></div>}</div>
      </section>
      <section className="leads-panel lead-list"><div className="panel-heading"><div><span className="eyebrow">CARTEIRA DE PROSPECÇÃO</span><h2>Estabelecimentos</h2><p>Filtre os leads e abra a ficha para mais detalhes.</p></div><a className="btn btn-secondary" href={`/api/exportar?${filters}`}><Download size={16}/> Exportar CSV</a></div>
        <div className="filters"><label className="search-field"><Search size={18}/><input aria-label="Buscar estabelecimentos" value={query} onChange={event=>setQuery(event.target.value)} placeholder="Buscar por nome, endereço ou telefone"/>{query && <button aria-label="Limpar busca" onClick={()=>setQuery("")}><X size={16}/></button>}</label><label className="select-field"><Filter size={17}/><select aria-label="Filtrar por UF" value={uf} onChange={e=>setUf(e.target.value)}><option value="">Todas as UFs</option>{states.map(state=><option key={state}>{state}</option>)}</select></label><label className="select-field"><select aria-label="Filtrar por segmento" value={segmento} onChange={e=>setSegmento(e.target.value)}><option value="">Todos os segmentos</option>{segmentos.map(s=><option key={s.id} value={s.id}>{s.descricao}</option>)}</select></label><label className="select-field"><select aria-label="Filtrar por situação" value={stateFilter} onChange={e=>setStateFilter(e.target.value)}><option value="">Todas as situações</option><option value="ativa_ou_desconhecida">Ativa ou desconhecida</option><option value="fechada_temporariamente">Fechada temporariamente</option><option value="fechada_permanentemente">Fechada permanentemente</option><option value="fechada">Fechada</option></select></label></div>
        {error && <div className="error-message" role="alert"><Activity size={18}/><span>{error}</span></div>}
        {loading && !page.items.length ? <div className="empty">Consultando estabelecimentos…</div> : !error && !page.items.length ? <div className="empty">Nenhum estabelecimento encontrado.</div> : <div className="table-scroll"><table><thead><tr><th>Estabelecimento</th><th>Local da busca</th><th>Telefone</th><th>Segmento</th><th>Situação</th><th><span className="sr-only">Detalhes</span></th></tr></thead><tbody>{page.items.map(row=><tr key={row.chave} onClick={()=>setSelected(row)} tabIndex={0} onKeyDown={event=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();setSelected(row);}}}><td><strong>{display(row.nome)}</strong><small>{display(row.categoria)}</small></td><td>{display(row.local_busca)}</td><td className="mono">{display(row.telefone)}</td><td>{display(row.segmento)}</td><td><span className="status-badge">{situacao(row.situacao)}</span></td><td><ChevronRight size={17}/></td></tr>)}</tbody></table></div>}
        {page.next_offset!==null && <div className="load-more"><button className="btn btn-secondary" disabled={loading} onClick={()=>void loadMore()}>{loading?"Carregando…":"Carregar mais"}</button></div>}
      </section><footer className="page-footer"><span>Fonte: Google Maps · Banco SQLite local</span><span>{page.items.length} de {page.total} registros carregados</span></footer>
    </main>
    {selected && <div className="overlay" onMouseDown={event=>{if(event.target===event.currentTarget)setSelected(null);}}><section className="drawer" role="dialog" aria-modal="true" aria-labelledby="detail-title"><header><div><span className="eyebrow">ESTABELECIMENTO</span><h2 id="detail-title">{display(selected.nome)}</h2><p>{display(selected.categoria)}</p></div><button aria-label="Fechar ficha" onClick={()=>setSelected(null)}><X/></button></header><dl>{[["Local da busca",selected.local_busca],["Segmento",selected.segmento],["Endereço",selected.endereco],["Telefone",selected.telefone],["Site",selected.site],["E-mail",selected.emails],["Situação",situacao(selected.situacao)],["Avaliação",selected.avaliacao],["Quantidade de avaliações",selected.qtd_avaliacoes],["Latitude",selected.latitude],["Longitude",selected.longitude]].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{display(value)}</dd></div>)}</dl><div className="drawer-links">{selected.link && <a href={selected.link} target="_blank" rel="noreferrer">Abrir no Maps</a>}{selected.whatsapp_link && <a href={selected.whatsapp_link} target="_blank" rel="noreferrer">Abrir WhatsApp</a>}</div></section></div>}
  </div>;
}
