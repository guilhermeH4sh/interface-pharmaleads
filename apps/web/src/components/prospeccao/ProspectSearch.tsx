import { useEffect, useState } from "react";
import { Search, Globe, MapPin, MessageCircle, ChevronLeft, ChevronRight } from "lucide-react";
import type { DataSourceMode, SupabaseSession } from "../../lib/backend";
import type { Lead } from "../../lib/crm";
import type { LeadItem } from "../../lib/mock-leads";
import { ESTABLISHMENTS, STATES, SOURCES, SEARCH_STATUSES, SEARCH_PAGE_SIZE, emptyProspectFilters, prospectTitle, searchSupabaseProspects, type ProspectFilters } from "../../lib/prospect-search";
import { formatNumberBR } from "../../lib/formatters";
import { ui } from "../../lib/ui";
import { cn } from "../../lib/utils";
import { ProspectMultiSelect } from "./ProspectMultiSelect";

type Row = Pick<Lead, "chave" | "nome" | "segmento" | "local_busca" | "telefone" | "telefone_normalizado" | "emails" | "site" | "link" | "whatsapp_link" | "crm_status">;
interface Props {
  dataSourceMode: DataSourceMode;
  session: SupabaseSession | null;
  onSessionUpdate?: (session: SupabaseSession) => void;
  realLeads: LeadItem[];
}
function safeUrl(value: string) {
  if (!value) return undefined;
  try {
    const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    return ["http:", "https:"].includes(url.protocol) ? url.href : undefined;
  } catch { return undefined; }
}

export function ProspectSearch({ dataSourceMode, session, onSessionUpdate, realLeads }: Props) {
  const [draft, setDraft] = useState(emptyProspectFilters);
  const [request, setRequest] = useState({ filters: emptyProspectFilters(), page: 1, revision: 0 });
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      setRows([]);
      setTotal(0);
      try {
        if (dataSourceMode === "supabase" && session) {
          const result = await searchSupabaseProspects(session, request.filters, request.page, controller.signal);
          if (cancelled) return;
          setRows(result.rows);
          setTotal(result.total);
          if (result.session !== session) onSessionUpdate?.(result.session);
        } else if (dataSourceMode === "local") {
          const filters = request.filters;
          const selected = realLeads.filter(lead =>
            (!filters.segments.length || filters.segments.includes(lead.segmento || "")) &&
            (!filters.states.length || filters.states.includes(lead.uf)) &&
            (!filters.sources.length || filters.sources.includes(lead.origem)) &&
            (!filters.statuses.length || filters.statuses.includes(lead.status))
          );
          setTotal(selected.length);
          setRows(selected.slice((request.page - 1) * SEARCH_PAGE_SIZE, request.page * SEARCH_PAGE_SIZE).map(lead => ({
            chave: lead.id, nome: lead.nome, segmento: lead.segmento || "", local_busca: `${lead.cidade}, ${lead.uf}`,
            telefone: lead.telefone, telefone_normalizado: "", emails: lead.email || "", site: lead.site || "",
            link: lead.link || "", whatsapp_link: lead.whatsappLink || "", crm_status: lead.status,
          })));
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Falha na pesquisa.");
      } finally { if (!cancelled) setLoading(false); }
    }
    queueMicrotask(() => { if (!cancelled) void load(); });
    return () => { cancelled = true; controller.abort(); };
  }, [dataSourceMode, session, onSessionUpdate, realLeads, request]);

  const choose = (key: keyof ProspectFilters, values: string[]) => setDraft(current => ({ ...current, [key]: values }));
  const totalPages = Math.max(1, Math.ceil(total / SEARCH_PAGE_SIZE));
  const connected = dataSourceMode === "local" || (dataSourceMode === "supabase" && Boolean(session));
  return (
    <section className="space-y-5" aria-label="Pesquisa de leads">
      <div>
        <h1 className={ui.pageTitle}>Pesquisar estabelecimentos</h1>
        <p className={ui.pageSubtitle}>Encontre contatos na base coletada e refine sua próxima prospecção.</p>
      </div>
      <form className={cn(ui.card, "p-4 sm:p-6")} onSubmit={event => {
        event.preventDefault();
        setRequest(current => ({ filters: draft, page: 1, revision: current.revision + 1 }));
      }}>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <ProspectMultiSelect label="Tipo de estabelecimento" options={ESTABLISHMENTS} values={draft.segments} onChange={values => choose("segments", values)} />
          <ProspectMultiSelect label="Estado" options={STATES} values={draft.states} onChange={values => choose("states", values)} />
          <ProspectMultiSelect label="Fonte dos dados" options={SOURCES} values={draft.sources} onChange={values => choose("sources", values)} />
          <ProspectMultiSelect label="Status do lead" options={SEARCH_STATUSES} values={draft.statuses} onChange={values => choose("statuses", values)} />
        </div>
        <div className="flex flex-wrap items-center gap-3 mt-5">
          <button type="submit" disabled={loading || !connected} className={cn(ui.btnBrand, "h-11 px-7")}><Search size={17} /> {loading ? "Pesquisando..." : "Pesquisar"}</button>
          <button type="button" className={cn(ui.btnSecondary, "h-11 px-4 text-sm")} onClick={() => {
            setDraft(emptyProspectFilters());
            setRequest(current => ({ filters: emptyProspectFilters(), page: 1, revision: current.revision + 1 }));
          }}>Limpar filtros</button>
        </div>
        <p className="mt-4 text-xs text-muted-foreground">A base atual é coletada pelo Google Maps. As demais fontes ainda não têm integração. Estados usam o local da busca registrada; o status Não qualificado ainda não possui registros.</p>
        {!connected && <p role="status" className="mt-3 text-sm text-brand">Entre no Supabase em Configurações para pesquisar os leads armazenados.</p>}
        {dataSourceMode === "local" && <p className="mt-3 text-xs text-muted-foreground">Fonte local: filtros e paginação aplicados aos registros carregados. No Supabase, a pesquisa é paginada no servidor.</p>}
      </form>

      <div className={cn(ui.card, "overflow-hidden")} aria-busy={loading}>
        <div className="p-4 sm:p-6 border-b border-border">
          <h2 className="font-bold text-base text-foreground break-words">{prospectTitle(request.filters)}</h2>
          <p className="text-sm text-muted-foreground mt-1" aria-live="polite">{loading ? "Consultando a base..." : `${formatNumberBR(total)} estabelecimentos encontrados`}</p>
        </div>
        {error ? <div role="alert" className="p-6 text-sm text-foreground">{error} <button type="button" className="text-brand underline ml-2" onClick={() => setRequest(current => ({ ...current, revision: current.revision + 1 }))}>Tentar novamente</button></div> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px] text-left text-sm">
              <caption className="sr-only">Resultados da pesquisa de estabelecimentos farmacêuticos</caption>
              <thead className="bg-surface text-muted-foreground"><tr>{["Farmácia", "Tipo", "Cidade/UF", "Telefone", "E-mail", "Fonte", "Status", "Links"].map(label => <th key={label} scope="col" className="px-4 py-3 text-xs font-semibold">{label}</th>)}</tr></thead>
              <tbody className="divide-y divide-border">
                {loading ? <tr><td colSpan={8} className="p-10 text-center text-muted-foreground" role="status">Carregando leads...</td></tr> : !rows.length ? <tr><td colSpan={8} className="p-10 text-center text-muted-foreground">Nenhum lead encontrado com esses filtros</td></tr> : rows.map(row => {
                  const site = safeUrl(row.site);
                  const maps = safeUrl(row.link);
                  const whatsapp = safeUrl(row.whatsapp_link);
                  return <tr key={row.chave} className="hover:bg-surface/60">
                    <td className="px-4 py-4 font-semibold">{row.nome}</td>
                    <td className="px-4 py-4">{ESTABLISHMENTS.find(option => option.value === row.segmento)?.label || row.segmento || "—"}</td>
                    <td className="px-4 py-4">{row.local_busca || "—"}</td>
                    <td className="px-4 py-4 whitespace-nowrap tabular-nums">{row.telefone || row.telefone_normalizado || "—"}</td>
                    <td className="px-4 py-4 break-words min-w-[190px]">{row.emails || "—"}</td>
                    <td className="px-4 py-4 whitespace-nowrap">Google Maps</td>
                    <td className="px-4 py-4 whitespace-nowrap">{row.crm_status || "Não contatado"}</td>
                    <td className="px-4 py-4"><div className="flex items-center gap-2">
                      {site && <a href={site} target="_blank" rel="noreferrer" aria-label={`Site ou rede social de ${row.nome}`} title={site} className={ui.iconBtn}><Globe size={16} /></a>}
                      {maps && <a href={maps} target="_blank" rel="noreferrer" aria-label={`Google Maps de ${row.nome}`} className={ui.iconBtn}><MapPin size={16} /></a>}
                      {whatsapp && <a href={whatsapp} target="_blank" rel="noreferrer" aria-label={`WhatsApp de ${row.nome}`} className={ui.iconBtn}><MessageCircle size={16} /></a>}
                    </div></td>
                  </tr>;
                })}
              </tbody>
            </table>
          </div>
        )}
        <nav aria-label="Paginação da pesquisa" className="border-t border-border px-4 py-4 flex flex-wrap items-center justify-between gap-3 text-sm">
          <span>Página {request.page} de {totalPages} · até {SEARCH_PAGE_SIZE} resultados por página</span>
          <div className="flex gap-2">
            <button type="button" aria-label="Página anterior da pesquisa" disabled={loading || request.page <= 1} className={cn(ui.btnSecondary, "h-10 px-3")} onClick={() => setRequest(current => ({ ...current, page: current.page - 1 }))}><ChevronLeft size={17} /> Anterior</button>
            <button type="button" aria-label="Próxima página da pesquisa" disabled={loading || request.page >= totalPages || Boolean(error)} className={cn(ui.btnSecondary, "h-10 px-3")} onClick={() => setRequest(current => ({ ...current, page: current.page + 1 }))}>Próxima <ChevronRight size={17} /></button>
          </div>
        </nav>
      </div>
    </section>
  );
}
