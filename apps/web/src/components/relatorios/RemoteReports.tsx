import { useEffect, useState } from "react";
import { AccessError, fetchLeadReport, fetchSupabaseAllLeads, mapRawLeadsToItems,
  type LeadReport, type SupabaseSession } from "../../lib/backend";
import { downloadLeadsCsv } from "../../lib/csv";
import { ui } from "../../lib/ui";
import { RelatoriosTab } from "./RelatoriosTab";

export function RemoteReports({ session, version, onSessionInvalid }: {
  session: SupabaseSession; version: number; onSessionInvalid: () => void;
}) {
  const [result, setResult] = useState<{
    session: SupabaseSession; version: number; retry: number; report?: LeadReport; error?: string;
  }>();
  const [exportError, setExportError] = useState("");
  const [retry, setRetry] = useState(0);
  const [exporting, setExporting] = useState(false);
  const current = result?.session === session && result?.version === version && result?.retry === retry ? result : undefined;
  const report = current?.report;
  const error = exportError || current?.error || "";
  useEffect(() => {
    const controller = new AbortController();
    void fetchLeadReport(session, controller.signal).then(data => {
      if (!controller.signal.aborted) setResult({ session, version, retry, report: data });
    }).catch((error: unknown) => {
      if (controller.signal.aborted) return;
      if (error instanceof AccessError) onSessionInvalid();
      setResult({ session, version, retry, error: error instanceof Error ? error.message : "Falha ao carregar relatórios." });
    });
    return () => controller.abort();
  }, [session, version, retry, onSessionInvalid]);

  async function exportAll() {
    if (exporting) return;
    setExporting(true);
    setExportError("");
    try {
      const result = await fetchSupabaseAllLeads(session);
      downloadLeadsCsv(mapRawLeadsToItems(result.rows), "pharmaleads_relatorio_completo");
    } catch (error) {
      if (error instanceof AccessError) onSessionInvalid();
      setExportError(error instanceof Error ? error.message : "Falha ao exportar os leads.");
    } finally { setExporting(false); }
  }

  return <>
    {error && <div role="alert" className={ui.card + " p-4 mb-4"}>
      <p>{error}</p>
      <button className={ui.btnSecondary + " mt-3 h-10 px-4"} onClick={() => { setExportError(""); setRetry(value => value + 1); }}>Tentar novamente</button>
    </div>}
    {!report && !error && <p role="status">Carregando relatórios…</p>}
    {report && <RelatoriosTab summary={report.summary} report={report} exporting={exporting} onExportFullCSV={() => void exportAll()} />}
  </>;
}
