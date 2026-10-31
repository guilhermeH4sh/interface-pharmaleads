import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, Building2, ChevronRight, Database, Filter, RefreshCw, Search, Users, X } from "lucide-react";
import { request, type Lead, type Page } from "./lib/crm";
import logo from "./assets/centrus-logo-original.png";
import "./crm.css";

const states = "AC AL AM AP BA CE DF ES GO MA MG MS MT PA PB PE PI PR RJ RN RO RR RS SC SE SP TO".split(" ");
const display = (value: string | null | undefined) => value?.trim() || "Não informado";
const formatCnpj = (value: string) => /^\d{14}$/.test(value) ? value.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5") : value;

export function Dashboard() {
  const [rows, setRows] = useState<Lead[]>([]);
  const [cursor, setCursor] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [uf, setUf] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Lead | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const url = `/v1/leads?limit=100${uf ? `&uf=${encodeURIComponent(uf)}` : ""}`;
    request<Page>(url, "", controller.signal)
      .then(page => { if (!controller.signal.aborted) { setRows(page.items); setCursor(page.next_after_id); setError(""); } })
      .catch(reason => { if (!controller.signal.aborted) { setRows([]); setCursor(null); setError(reason instanceof TypeError ? "Não foi possível conectar à API. Verifique a conexão e a configuração de acesso." : reason instanceof Error ? reason.message : "Falha ao consultar os estabelecimentos."); } })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [uf, version]);

  const refresh = useCallback(() => { setError(""); setRows([]); setCursor(null); setLoading(true); setVersion(current => current + 1); }, []);
  const filtered = useMemo(() => {
    const value = query.trim().toLocaleLowerCase("pt-BR");
    return rows.filter(row => !value || `${row.nome} ${row.razao_social ?? ""} ${row.cnpj} ${row.cidade} ${row.uf}`.toLocaleLowerCase("pt-BR").includes(value));
  }, [rows, query]);
  const loadMore = async () => {
    if (cursor === null || loading) return;
    setLoading(true); setError("");
    try {
      const page = await request<Page>(`/v1/leads?limit=100&after_id=${cursor}${uf ? `&uf=${encodeURIComponent(uf)}` : ""}`, "");
      setRows(current => [...current, ...page.items]); setCursor(page.next_after_id);
    } catch (reason) { setError(reason instanceof TypeError ? "Não foi possível conectar à API." : reason instanceof Error ? reason.message : "Falha ao carregar registros."); }
    finally { setLoading(false); }
  };
  const available = !error && !loading;
  const ufCount = new Set(rows.map(row => row.uf).filter(Boolean)).size;

  return <div className="app-shell">
    <header className="app-header"><div className="header-container">
      <a className="brand-section" href="#leads"><img className="brand-logo-img" src={logo} alt="Centrus AI"/><span><strong className="brand-name">Centrus <b>PharmaLeads</b></strong><small className="brand-subtitle">Inteligência Farmacêutica · B2B</small></span></a>
      <nav className="header-nav" aria-label="Navegação principal"><a className="nav-link active" href="#leads"><Users size={17}/> Leads</a></nav>
      <span className="connection-status"><span className={available ? "status-dot online" : "status-dot"}/>{loading ? "Consultando" : error ? "Consulta indisponível" : "Dados consultados"}</span>
    </div></header>
    <main className="main-wrapper" id="leads">
      <section className="page-title-row"><div><span className="eyebrow">CENTRUS PHARMALEADS</span><h1>Prospecção e Gestão de Contas Farmacêuticas</h1><p>Consulte os estabelecimentos disponíveis para prospecção e relacionamento.</p></div><button className="btn btn-primary" onClick={refresh} disabled={loading}><RefreshCw size={16}/> Atualizar leads</button></section>
      <section className="kpi-section" aria-label="Resumo dos registros carregados">
        <article className="kpi-card highlight"><div className="kpi-header"><span>Estabelecimentos carregados</span><Users size={19}/></div><strong className="kpi-value">{available ? rows.length : "—"}</strong><p>{cursor !== null ? "Existem mais registros para carregar" : "Registros retornados pela consulta"}</p></article>
        <article className="kpi-card"><div className="kpi-header"><span>UFs nos registros carregados</span><Building2 size={19}/></div><strong className="kpi-value">{available ? ufCount : "—"}</strong><p>Distribuição da seleção atual</p></article>
        <article className="kpi-card"><div className="kpi-header"><span>Resultados da busca</span><Search size={19}/></div><strong className="kpi-value">{available ? filtered.length : "—"}</strong><p>Nome, CNPJ ou município</p></article>
        <article className="kpi-card source-card"><div className="kpi-header"><span>Fonte dos dados</span><Database size={19}/></div><strong>Supabase</strong><p>Consulta pela API PharmaLeads</p></article>
      </section>
      <section className="leads-panel"><div className="panel-heading"><div><span className="eyebrow">CARTEIRA DE PROSPECÇÃO</span><h2>Estabelecimentos</h2><p>Consulte os registros disponíveis e abra a ficha para mais detalhes.</p></div><span className="count-badge">{error ? "Consulta indisponível" : loading && !rows.length ? "Consultando…" : `${filtered.length} carregados`}</span></div>
        <div className="filters"><label className="search-field"><Search size={18}/><input aria-label="Buscar estabelecimentos" value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar por nome, CNPJ ou município"/>{query && <button aria-label="Limpar busca" onClick={() => setQuery("")}><X size={16}/></button>}</label><label className="select-field"><Filter size={17}/><select aria-label="Filtrar por UF" value={uf} onChange={event => { setUf(event.target.value); setRows([]); setCursor(null); setError(""); setLoading(true); }}><option value="">Todas as UFs</option>{states.map(state => <option key={state}>{state}</option>)}</select></label></div>
        {error && <div className="error-message" role="alert"><Activity size={18}/><span>{error}</span></div>}
        {loading && !rows.length ? <div className="empty">Consultando estabelecimentos…</div> : !error && !filtered.length ? <div className="empty">Nenhum estabelecimento encontrado.</div> : <div className="table-scroll"><table><thead><tr><th>Estabelecimento</th><th>CNPJ</th><th>Município / UF</th><th>CNAE</th><th>Status</th><th><span className="sr-only">Detalhes</span></th></tr></thead><tbody>{filtered.map(row => <tr key={row.id} onClick={() => setSelected(row)} tabIndex={0} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelected(row); } }}><td><strong>{row.nome}</strong><small>{display(row.razao_social)}</small></td><td className="mono">{formatCnpj(row.cnpj)}</td><td>{display(row.cidade)} / {row.uf}</td><td>{display(row.cnae)}</td><td><span className="status-badge">{display(row.status)}</span></td><td><ChevronRight size={17}/></td></tr>)}</tbody></table></div>}
        {cursor !== null && <div className="load-more"><button className="btn btn-secondary" disabled={loading} onClick={() => void loadMore()}>{loading ? "Carregando…" : "Carregar mais"}</button></div>}
      </section><footer className="page-footer"><span>Fonte: public.pharmaleads via API</span><span>{error ? "Dados indisponíveis" : `${rows.length} registros carregados`}</span></footer>
    </main>
    {selected && <div className="overlay" onMouseDown={event => { if (event.target === event.currentTarget) setSelected(null); }}><section className="drawer" role="dialog" aria-modal="true" aria-labelledby="detail-title"><header><div><span className="eyebrow">ESTABELECIMENTO · #{selected.id}</span><h2 id="detail-title">{selected.nome}</h2><p>{display(selected.razao_social)}</p></div><button aria-label="Fechar ficha" onClick={() => setSelected(null)}><X/></button></header><dl>{[["CNPJ",formatCnpj(selected.cnpj)],["Município",selected.cidade],["UF",selected.uf],["CNAE",selected.cnae],["Endereço",selected.endereco],["Bairro",selected.bairro],["Status",selected.status],["Responsável",selected.responsavel]].map(([label,value]) => <div key={label}><dt>{label}</dt><dd>{display(value)}</dd></div>)}</dl></section></div>}
  </div>;
}
