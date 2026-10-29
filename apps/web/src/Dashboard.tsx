import { useEffect, useRef, useState } from "react";
import { ArrowRight, Building2, ChevronRight, Columns3, List, LogOut, RefreshCw, Search, X } from "lucide-react";
import { login, request, type Lead, type Page, type Session } from "./lib/crm";
import "./crm.css";

const stages = ["Não contatado", "Em contato", "Respondido", "Qualificado", "Sem interesse"];
const ufs = "AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO".split(" ");
const display = (value: string | null | undefined) => value || "Não informado";

export function Dashboard() {
  const [session, setSession] = useState<Session | null>(import.meta.env.VITE_LOCAL_PILOT ? { token: "", profile: { email: "Snapshot real do piloto", role: "Consulta local · sem login", scopes: [] } } : null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState<Lead[]>([]);
  const [cursor, setCursor] = useState<number | null>(null);
  const [uf, setUf] = useState("");
  const [search, setSearch] = useState("");
  const [view, setView] = useState("board");
  const [selected, setSelected] = useState<Lead | null>(null);
  const [revision, setRevision] = useState(0);
  const dialog = useRef<HTMLDialogElement>(null);
  const controller = useRef<AbortController | null>(null);
  const detailTrigger = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!session) return;
    const abort = new AbortController(); controller.current = abort;
    void request<Page>(`/v1/leads?limit=100${uf ? `&uf=${uf}` : ""}`, session.token, abort.signal)
      .then(data => { if (!abort.signal.aborted) { setRows(data.items); setCursor(data.next_after_id); } })
      .catch(e => { if (!abort.signal.aborted) setError(e instanceof Error ? e.message : "Conexão indisponível."); })
      .finally(() => { if (!abort.signal.aborted) setBusy(false); });
    return () => abort.abort();
  }, [session, uf, revision]);
  useEffect(() => { if (selected) dialog.current?.showModal(); }, [selected]);
  const filtered = rows.filter(row => `${row.nome} ${row.razao_social || ""} ${row.cnpj} ${row.cidade}`.toLocaleLowerCase("pt-BR").includes(search.toLocaleLowerCase("pt-BR")));
  const reset = () => { controller.current?.abort(); setSession(null); setRows([]); setSelected(null); setCursor(null); setError(""); setBusy(false); };
  const refresh = () => { setError(""); setBusy(true); setRows([]); setCursor(null); setRevision(v => v + 1); };
  const open = (row: Lead) => { detailTrigger.current = document.activeElement as HTMLElement; setSelected(row); };
  const close = () => { setSelected(null); detailTrigger.current?.focus(); };

  if (!session) return <div className="login-layout"><section className="login-story"><a className="wordmark" href="https://centrusai.com">centrus<span>AI</span></a><p className="overline">PHARMALEADS / INTELIGÊNCIA COMERCIAL</p><h1>Mais contexto.<br />Melhores conexões.</h1><p>Uma visão organizada dos estabelecimentos, da origem dos dados e de cada etapa da prospecção.</p><div className="story-rule"/><small>Dados reais · Acesso autenticado · Prospecção farmacêutica</small></section><main className="login-panel"><div><p className="overline">BEM-VINDO AO PHARMALEADS</p><h2>Seu próximo contato<br />começa aqui.</h2><p className="muted">Entre com sua conta autorizada do Supabase.</p><form onSubmit={async event => { event.preventDefault(); const form = event.currentTarget; const data = new FormData(form); setBusy(true); setError(""); try { const result = await login(String(data.get("email")), String(data.get("password")), String(data.get("key") || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "").trim()); form.reset(); setRows([]); setSession(result); } catch (e) { setError(e instanceof Error ? e.message : "Falha ao entrar."); setBusy(false); } }}>
      <label>E-mail<input name="email" type="email" autoComplete="username" required /></label><label>Senha<input name="password" type="password" autoComplete="current-password" required /></label>
      {!import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY && <label>Chave publicável do projeto<input name="key" autoComplete="off" placeholder="sb_publishable_…" required /><small>Configuração de conexão fornecida pelo administrador.</small></label>}
      {error && <p role="alert" className="error">{error}</p>}<button className="primary" disabled={busy}>{busy ? "Conectando…" : "Acessar plataforma"}<ArrowRight size={18}/></button></form><p className="login-foot">Centrus AI · PharmaLeads</p></div></main></div>;

  return <div className="crm"><a className="skip" href="#content">Pular para o conteúdo</a><header className="app-header"><a className="wordmark" href="/">centrus<span>AI</span></a><span className="product">PharmaLeads</span><nav aria-label="Navegação principal"><span aria-current="page"><Building2 size={17}/>Estabelecimentos</span></nav><div className="identity"><strong>{session.profile.email}</strong><small>{session.profile.role}</small></div><button title="Sair" aria-label="Sair" onClick={reset}><LogOut size={18}/></button></header>
    <main id="content"><div className="page-heading"><div><p className="overline">RELACIONAMENTO / PROSPECÇÃO</p><h1>Pipeline de leads<span className="live">{import.meta.env.VITE_LOCAL_PILOT ? "Piloto local" : "Supabase"}</span></h1><p className="muted">{import.meta.env.VITE_LOCAL_PILOT ? "Snapshot dos 100 cadastros importados. Status e responsáveis atuais do Supabase não disponíveis nesta consulta local." : "Conheça cada estabelecimento. Organize a próxima conversa."}</p></div><button onClick={refresh} disabled={busy}><RefreshCw size={16} className={busy ? "spin" : ""}/>{busy ? "Atualizando…" : "Atualizar"}</button></div>
    <div className="toolbar"><label className="search"><Search size={18}/><input aria-label="Buscar nos leads carregados" placeholder="Buscar nome, CNPJ ou município…" value={search} onChange={e => setSearch(e.target.value)}/></label><select aria-label="Filtrar por UF" value={uf} onChange={e => { setUf(e.target.value); setRows([]); setCursor(null); setError(""); setBusy(true); }}><option value="">Todas as UFs</option>{ufs.map(value => <option key={value}>{value}</option>)}</select><span className="result-count">{busy ? "Consultando…" : `${filtered.length} exibidos / ${rows.length} carregados`}</span><div className="view-switch" aria-label="Modo de visualização"><button aria-label="Quadro" aria-pressed={view === "board"} onClick={() => setView("board")}><Columns3 size={18}/></button><button aria-label="Lista" aria-pressed={view === "list"} onClick={() => setView("list")}><List size={18}/></button></div></div>
    {error && <div className="error" role="alert">{error}</div>}
    {busy && rows.length === 0 ? <div className="empty" role="status"><RefreshCw className="spin"/>Carregando estabelecimentos…</div> : view === "board" ? <div className="board">{[...stages, ...(filtered.some(row => !stages.includes(row.status || "")) ? ["Sem status"] : [])].map((stage, index) => { const items = filtered.filter(row => stage === "Sem status" ? !stages.includes(row.status || "") : row.status === stage); return <section className="lane" key={stage}><div className="lane-heading"><span className="lane-index">{String(index + 1).padStart(2, "0")}</span><h2>{stage}</h2><span className="count">{items.length}</span></div><div className="lane-items">{items.map(row => <button className="lead-card" key={row.id} onClick={() => open(row)}><span className="card-top"><span>#{row.id}</span><span className="uf">{row.uf}</span></span><strong>{row.nome}</strong><span className="company">{display(row.razao_social)}</span><span className="card-bottom">{row.cidade}<ChevronRight size={15}/></span></button>)}{!items.length && <p className="lane-empty">Nenhum lead carregado<br />nesta etapa.</p>}</div></section>; })}</div> : <div className="table-wrap"><table><thead><tr><th>Estabelecimento</th><th>CNPJ</th><th>Localização</th><th>Etapa</th></tr></thead><tbody>{filtered.map(row => <tr key={row.id}><td><button className="text-button" onClick={() => open(row)}>{row.nome}</button><small>{display(row.razao_social)}</small></td><td>{row.cnpj}</td><td>{row.cidade} / {row.uf}</td><td>{display(row.status)}</td></tr>)}</tbody></table>{!filtered.length && <p className="empty">Nenhum estabelecimento encontrado neste recorte.</p>}</div>}
    {cursor !== null && <button disabled={busy} className="load-more" onClick={async () => { setBusy(true); setError(""); const abort = new AbortController(); controller.current = abort; try { const data = await request<Page>(`/v1/leads?limit=100&after_id=${cursor}${uf ? `&uf=${uf}` : ""}`, session.token, abort.signal); if (!abort.signal.aborted) { setRows(old => [...old, ...data.items]); setCursor(data.next_after_id); } } catch (e) { if (!abort.signal.aborted) setError(e instanceof Error ? e.message : "Falha ao carregar."); } finally { if (!abort.signal.aborted) setBusy(false); } }}>Carregar mais estabelecimentos</button>}
    <footer>{import.meta.env.VITE_LOCAL_PILOT ? "Fonte: arquivo real do piloto M05, auditado no M07 · Sem sincronização ao vivo" : "Registros reais de public.pharmaleads"} · Contagens do recorte carregado · Edição comercial em implementação</footer></main>
    <dialog ref={dialog} onCancel={close} onClose={close} className="lead-detail" aria-labelledby="detail-name">{selected && <><div className="detail-top"><span className="overline">ESTABELECIMENTO #{selected.id}</span><button aria-label="Fechar ficha" onClick={() => dialog.current?.close()}><X size={20}/></button></div><h2 id="detail-name">{selected.nome}</h2><p className="muted">{display(selected.razao_social)}</p><span className="status-label">{display(selected.status)}</span><dl>{[["CNPJ", selected.cnpj], ["CNAE", selected.cnae], ["Município / UF", `${selected.cidade} / ${selected.uf}`], ["Endereço", selected.endereco], ["Bairro", selected.bairro], ["Responsável (ID)", selected.responsavel]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{display(value)}</dd></div>)}</dl><div className="detail-note">Contatos e evidências serão exibidos quando a API disponibilizar a consulta autorizada desses campos.</div></>}</dialog>
  </div>;
}
