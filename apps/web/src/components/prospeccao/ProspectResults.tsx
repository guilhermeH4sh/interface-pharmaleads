import { useEffect, useState } from "react";
import { AccessError, fetchProspectPage, type ProspectFilters, type SupabaseSession } from "../../lib/backend";
import { parseLeadEmails } from "../../lib/email";
import { formatPhone } from "../../lib/formatters";
import { ui } from "../../lib/ui";
import { cn } from "../../lib/utils";

interface Props {
  filters: ProspectFilters;
  session: SupabaseSession;
  updates: number;
  onSessionUpdate?: (session: SupabaseSession) => void;
  onSessionInvalid?: () => void;
}

function webLink(value: string | undefined) {
  try {
    const url = new URL(value ?? "");
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : undefined;
  } catch {
    return undefined;
  }
}

export function ProspectResults({ filters, session, updates, onSessionUpdate, onSessionInvalid }: Props) {
  const [request, setRequest] = useState<{ cursors: Array<string | null>; updates: number }>({ cursors: [null], updates: 0 });
  const [response, setResponse] = useState<{
    request: typeof request;
    page?: Awaited<ReturnType<typeof fetchProspectPage>>;
    error?: string;
  }>();
  useEffect(() => {
    const controller = new AbortController();
    const cursor = request.cursors[request.cursors.length - 1];
    void fetchProspectPage(session, filters, cursor, controller.signal).then(page => {
      if (controller.signal.aborted) return;
      setResponse({ request, page });
      if (page.session !== session) onSessionUpdate?.(page.session);
    }).catch((error: unknown) => {
      if (controller.signal.aborted) return;
      if (error instanceof AccessError) onSessionInvalid?.();
      setResponse({
        request,
        error: error instanceof Error && error.name !== "TimeoutError"
          ? error.message : "A consulta demorou para responder. Tente novamente.",
      });
    });
    return () => controller.abort();
  }, [request, session, filters, onSessionUpdate, onSessionInvalid]);

  const current = response?.request === request ? response : undefined;
  const page = current?.page;
  const nextCursor = page?.nextCursor;
  return (
    <section aria-label="Resultados da prospecção" aria-busy={!current} className="space-y-4 rounded-xl border border-input bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Resultados da pesquisa</h2>
        <button type="button" className={ui.btnSecondary} disabled={!current}
          onClick={() => setRequest({ cursors: [null], updates })}>
          {updates > request.updates ? "Atualizar resultados da coleta" : "Atualizar resultados"}
        </button>
      </div>
      {!current && <p role="status">Consultando leads no Supabase…</p>}
      {current?.error && (
        <div>
          <p role="alert">{current.error}</p>
          <button type="button" className={cn(ui.btnSecondary, "mt-2")}
            onClick={() => setRequest({ ...request })}>Repetir consulta</button>
        </div>
      )}
      {page && !page.items.length && <p role="status">{request.cursors.length === 1
        ? "Nenhum lead encontrado com esses filtros." : "Nenhum lead encontrado nesta página."}</p>}
      {page && page.items.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted">
              <tr>{["Estabelecimento", "Endereço", "Telefone", "E-mail", "Site e redes", "Avaliação"].map(label => (
                <th key={label} scope="col" className="px-3 py-2 font-medium">{label}</th>
              ))}</tr>
            </thead>
            <tbody className="divide-y divide-border">
              {page.items.map(lead => {
                const emails = parseLeadEmails(lead.email);
                const site = webLink(lead.site);
                const redes = Object.entries(lead.redes ?? {}).flatMap(([name, value]) => {
                  const href = webLink(value);
                  return href ? [{ name, href }] : [];
                });
                return (
                  <tr key={lead.id} className="[&>td]:px-3 [&>td]:py-3 [&>td]:align-top">
                    <td>
                      <strong>{lead.nome}</strong>
                      <div className="text-xs text-muted-foreground">{lead.origem}</div>
                      {lead.crmIncluded && <span className="text-xs text-brand">Já está no CRM</span>}
                    </td>
                    <td>
                      <div>{lead.endereco || "—"}</div>
                      <div className="text-xs text-muted-foreground">{[lead.cidade, lead.uf].filter(Boolean).join(" / ")}</div>
                    </td>
                    <td className="whitespace-nowrap">{formatPhone(lead.telefone)}</td>
                    <td>{emails.length ? emails.map(email => <div key={email}>{email}</div>) : "—"}</td>
                    <td>
                      {site && <a className="block text-brand underline" href={site} target="_blank" rel="noreferrer">Site</a>}
                      {redes.map(({ name, href }) => (
                        <a className="block text-brand underline" key={name} href={href} target="_blank" rel="noreferrer">{name}</a>
                      ))}
                      {!site && !redes.length && "—"}
                    </td>
                    <td>{lead.avaliacao?.toLocaleString("pt-BR") ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {page && (request.cursors.length > 1 || nextCursor) && (
        <nav aria-label="Páginas dos resultados" className="flex flex-wrap items-center justify-end gap-3 text-sm">
          <button type="button" className={ui.btnSecondary} disabled={request.cursors.length === 1}
            onClick={() => setRequest({ ...request, cursors: request.cursors.slice(0, -1) })}>Anterior</button>
          <span>Página {request.cursors.length}</span>
          <button type="button" className={ui.btnSecondary} disabled={!nextCursor}
            onClick={() => { if (nextCursor) setRequest({ ...request, cursors: [...request.cursors, nextCursor] }); }}>Próxima</button>
        </nav>
      )}
    </section>
  );
}
