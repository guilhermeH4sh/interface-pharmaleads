import { useEffect, useState, type CSSProperties } from "react";
import { MoreHorizontal, ChevronLeft, ChevronRight, Eye, Trash2, Check, SearchX, BriefcaseBusiness } from "lucide-react";
import { formatCNPJ, formatPhone, buildWhatsAppLink, formatNumberBR } from "../../lib/formatters";
import { ui } from "../../lib/ui";
import { cn } from "../../lib/utils";
import { StatusBadge } from "./StatusBadge";
import type { LeadItem, LeadStatus } from "../../lib/mock-leads";
import { parseLeadEmails } from "../../lib/email";

const STATUSES: LeadStatus[] = ["Qualificado", "Em contato", "Respondido", "Não qualificado", "Não contatado"];

interface LeadsTableProps {
  items: LeadItem[];
  total: number;
  currentPage: number;
  totalPages: number;
  pageSize?: number;
  isLoading: boolean;
  onPageChange: (page: number) => void;
  onViewDetails: (lead: LeadItem) => void;
  onChangeStatus: (leadId: string, newStatus: LeadStatus) => void;
  onDeleteLead: (leadId: string) => void;
  onCrmMembershipChange: (leadId: string, included: boolean) => void;
  selectedIds: string[];
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: () => void;
}

function WhatsAppIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  );
}

/** Páginas exibidas: 1 2 3 4 5 … N (com janela ao redor da página atual). */
function pageList(current: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  if (current <= 4) return [1, 2, 3, 4, 5, "…", total];
  if (current >= total - 3) return [1, "…", total - 4, total - 3, total - 2, total - 1, total];
  return [1, "…", current - 1, current, current + 1, "…", total];
}

export function LeadsTable({
  items,
  total,
  currentPage,
  totalPages,
  pageSize = 5,
  isLoading,
  onPageChange,
  onViewDetails,
  onChangeStatus,
  onDeleteLead,
  onCrmMembershipChange,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
}: LeadsTableProps) {
  // Menu "..." renderizado em posição fixa para não ser cortado pelo container da tabela
  const [menu, setMenu] = useState<{ lead: LeadItem; style: CSSProperties } | null>(null);

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("click", close);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    document.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [menu]);

  const openMenu = (lead: LeadItem, button: HTMLElement) => {
    const rect = button.getBoundingClientRect();
    const right = window.innerWidth - rect.right;
    const style: CSSProperties =
      rect.bottom + 340 > window.innerHeight
        ? { position: "fixed", right, bottom: window.innerHeight - rect.top + 6 }
        : { position: "fixed", right, top: rect.bottom + 6 };
    setMenu(menu?.lead.id === lead.id ? null : { lead, style });
  };

  const confirmDelete = (lead: LeadItem) => {
    if (window.confirm(`Excluir o lead "${lead.nome}"?`)) onDeleteLead(lead.id);
  };

  const allSelected = items.length > 0 && items.every((item) => selectedIds.includes(item.id));
  const someSelected = items.some((item) => selectedIds.includes(item.id)) && !allSelected;
  const start = total === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const end = total === 0 ? 0 : Math.min(currentPage * pageSize, total);

  const empty = (
    <div className="py-14 px-6 text-center">
      <div className="mx-auto w-12 h-12 rounded-full bg-primary-soft text-brand flex items-center justify-center">
        <SearchX size={22} />
      </div>
      <p className="mt-4 font-semibold text-foreground">Nenhum lead encontrado com esses filtros</p>
      <p className="text-sm text-muted-foreground mt-1">Ajuste a busca ou limpe os filtros laterais.</p>
    </div>
  );

  return (
    <div className="w-full">
      {/* Desktop (≥768px): tabela semântica */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[850px]">
          <caption className="sr-only">Lista de leads de farmácias</caption>
          <thead>
            <tr className="bg-surface border-y border-border text-xs font-semibold text-muted-foreground">
              <th scope="col" className="py-3 pl-6 pr-3 w-12">
                <input
                  type="checkbox"
                  aria-label="Selecionar todos os leads da página"
                  checked={allSelected}
                  ref={(input) => {
                    if (input) input.indeterminate = someSelected;
                  }}
                  onChange={onToggleSelectAll}
                  className={ui.checkbox}
                />
              </th>
              <th scope="col" className="py-3 px-3">Farmácia</th>
              <th scope="col" className="py-3 px-3">CNPJ</th>
              <th scope="col" className="py-3 px-3">Cidade / UF</th>
              <th scope="col" className="py-3 px-3">Telefone</th>
              <th scope="col" className="py-3 px-3">Status</th>
              <th scope="col" className="py-3 px-3">E-mail</th>
              <th scope="col" className="py-3 pr-6 pl-3 text-right">
                <span className="sr-only">Ações</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border text-sm">
            {isLoading ? (
              Array.from({ length: pageSize }).map((_, idx) => (
                <tr key={idx} className="animate-pulse">
                  <td className="py-4 pl-6 pr-3"><div className="w-4 h-4 rounded bg-muted" /></td>
                  <td className="py-4 px-3"><div className="h-4 w-36 rounded bg-muted" /></td>
                  <td className="py-4 px-3"><div className="h-4 w-28 rounded bg-muted" /></td>
                  <td className="py-4 px-3"><div className="h-4 w-24 rounded bg-muted" /></td>
                  <td className="py-4 px-3"><div className="h-4 w-28 rounded bg-muted" /></td>
                  <td className="py-4 px-3"><div className="h-6 w-20 rounded-full bg-muted" /></td>
                  <td className="py-4 px-3"><div className="h-4 w-32 rounded bg-muted" /></td>
                  <td className="py-4 pr-6 pl-3"><div className="w-8 h-8 rounded-lg bg-muted ml-auto" /></td>
                </tr>
              ))
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={8}>{empty}</td>
              </tr>
            ) : (
              items.map((row) => {
                const isSelected = selectedIds.includes(row.id);
                const emails = parseLeadEmails(row.email);
                return (
                  <tr
                    key={row.id}
                    onClick={() => onViewDetails(row)}
                    className={cn("cursor-pointer transition-colors hover:bg-muted/60", isSelected && "bg-primary-soft/60")}
                  >
                    <td className="py-3.5 pl-6 pr-3" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        aria-label={`Selecionar ${row.nome}`}
                        checked={isSelected}
                        onChange={() => onToggleSelect(row.id)}
                        className={ui.checkbox}
                      />
                    </td>
                    <td className="py-3.5 px-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onViewDetails(row);
                        }}
                        className="font-bold text-foreground hover:text-brand text-left transition-colors"
                      >
                        {row.nome}
                      </button>
                    </td>
                    <td className="py-3.5 px-3 text-muted-foreground tabular-nums whitespace-nowrap">{formatCNPJ(row.cnpj)}</td>
                    <td className="py-3.5 px-3 text-foreground whitespace-nowrap">{row.cidade} / {row.uf}</td>
                    <td className="py-3.5 px-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-1.5 tabular-nums text-foreground whitespace-nowrap">
                        <span>{formatPhone(row.telefone)}</span>
                        <a
                          href={buildWhatsAppLink(row.telefone)}
                          target="_blank"
                          rel="noreferrer"
                          aria-label={`Abrir WhatsApp de ${row.nome}`}
                          title="Abrir no WhatsApp"
                          className="w-7 h-7 inline-flex items-center justify-center rounded-md text-brand hover:bg-primary-soft transition-colors"
                        >
                          <WhatsAppIcon />
                        </a>
                      </div>
                    </td>
                    <td className="py-3.5 px-3"><StatusBadge status={row.status} /></td>
                    <td className="py-3.5 px-3 text-muted-foreground max-w-[190px]">
                      {emails.length ? (
                        <div className="flex items-center gap-1 min-w-0" title={emails.join(", ")}>
                          <a href={`mailto:${emails[0]}`} onClick={(event) => event.stopPropagation()} className="truncate text-brand hover:underline">{emails[0]}</a>
                          {emails.length > 1 && <span className="shrink-0 text-xs">+{emails.length - 1}</span>}
                        </div>
                      ) : "—"}
                    </td>
                    <td className="py-3.5 pr-6 pl-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openMenu(row, e.currentTarget);
                        }}
                        aria-label={`Ações para ${row.nome}`}
                        aria-haspopup="menu"
                        aria-expanded={menu?.lead.id === row.id}
                        className={cn(ui.btnGhost, "w-9 h-9")}
                      >
                        <MoreHorizontal size={18} />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile (<768px): lista de cards, sem rolagem horizontal */}
      <ul className="md:hidden divide-y divide-border border-t border-border">
        {isLoading
          ? Array.from({ length: 4 }).map((_, idx) => (
              <li key={idx} className="p-4 animate-pulse space-y-3">
                <div className="h-5 w-44 rounded bg-muted" />
                <div className="h-4 w-28 rounded bg-muted" />
                <div className="h-11 w-full rounded-lg bg-muted" />
              </li>
            ))
          : items.length === 0
            ? <li>{empty}</li>
            : items.map((row) => {
                const primaryEmail = parseLeadEmails(row.email)[0];
                return <li key={row.id} className={cn("p-4", selectedIds.includes(row.id) && "bg-primary-soft/60")}>
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      aria-label={`Selecionar ${row.nome}`}
                      checked={selectedIds.includes(row.id)}
                      onChange={() => onToggleSelect(row.id)}
                      className={cn(ui.checkbox, "mt-1")}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-bold text-foreground truncate">{row.nome}</h3>
                        <StatusBadge status={row.status} />
                      </div>
                      <p className="text-sm text-muted-foreground mt-0.5">{row.cidade} / {row.uf}</p>
                      <p className="text-sm text-foreground tabular-nums mt-0.5">{formatPhone(row.telefone)}</p>
                      <p className="text-sm text-muted-foreground mt-0.5 truncate">
                        E-mail: {primaryEmail ? <a href={`mailto:${primaryEmail}`} className="text-brand hover:underline">{primaryEmail}</a> : "—"}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-[1fr_1fr_auto] gap-2">
                    <a
                      href={buildWhatsAppLink(row.telefone)}
                      target="_blank"
                      rel="noreferrer"
                      className={cn(ui.btnSecondary, "h-11 text-sm")}
                    >
                      <WhatsAppIcon /> WhatsApp
                    </a>
                    <button onClick={() => onViewDetails(row)} className={cn(ui.btnSecondary, "h-11 text-sm")}>
                      <Eye size={16} /> Detalhes
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openMenu(row, e.currentTarget);
                      }}
                      aria-label={`Ações para ${row.nome}`}
                      aria-haspopup="menu"
                      className={cn(ui.btnSecondary, "h-11 w-11")}
                    >
                      <MoreHorizontal size={18} />
                    </button>
                  </div>
                </li>;
              })}
      </ul>

      {/* Rodapé: contagem + paginação */}
      <div className="px-4 py-4 md:px-6 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-muted-foreground">
        <p className="tabular-nums">
          Mostrando <span className="font-semibold text-foreground">{start} – {end}</span> de{" "}
          <span className="font-semibold text-foreground">{formatNumberBR(total)}</span> leads
        </p>

        <nav aria-label="Paginação" className="flex items-center gap-1">
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage <= 1 || isLoading}
            aria-label="Página anterior"
            className="w-9 h-9 inline-flex items-center justify-center rounded-lg border border-border bg-card hover:text-foreground hover:border-primary/40 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft size={16} />
          </button>
          {pageList(currentPage, totalPages).map((p, idx) =>
            p === "…" ? (
              <span key={`gap-${idx}`} className="px-1" aria-hidden="true">…</span>
            ) : (
              <button
                key={p}
                onClick={() => onPageChange(p)}
                disabled={isLoading}
                aria-label={`Página ${p}`}
                aria-current={p === currentPage ? "page" : undefined}
                className={cn(
                  "min-w-9 h-9 px-2 rounded-lg text-sm font-semibold tabular-nums transition-colors",
                  p === currentPage
                    ? "bg-primary text-primary-foreground"
                    : "border border-border bg-card hover:text-foreground hover:border-primary/40",
                  // No mobile, mostra apenas página atual, primeira e última
                  p !== currentPage && p !== 1 && p !== totalPages && "hidden sm:inline-block"
                )}
              >
                {p}
              </button>
            )
          )}
          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage >= totalPages || isLoading}
            aria-label="Próxima página"
            className="w-9 h-9 inline-flex items-center justify-center rounded-lg border border-border bg-card hover:text-foreground hover:border-primary/40 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight size={16} />
          </button>
        </nav>
      </div>

      {/* Menu de ações por linha */}
      {menu && (
        <div role="menu" style={menu.style} onClick={(e) => e.stopPropagation()} className={cn(ui.menu, "w-56 z-50")}>
          <button role="menuitem" className={ui.menuItem} onClick={() => { onViewDetails(menu.lead); setMenu(null); }}>
            <Eye size={16} /> Ver detalhes
          </button>
          <button
            role="menuitem"
            className={ui.menuItem}
            onClick={() => {
              onCrmMembershipChange(menu.lead.id, true);
              setMenu(null);
            }}
          >
            <BriefcaseBusiness size={16} /> Marcar em contato e adicionar ao CRM
          </button>
          <a
            role="menuitem"
            href={buildWhatsAppLink(menu.lead.telefone)}
            target="_blank"
            rel="noreferrer"
            className={ui.menuItem}
            onClick={() => setMenu(null)}
          >
            <WhatsAppIcon /> Abrir no WhatsApp
          </a>
          <div className="border-t border-border my-1" />
          <p className="px-3 pt-1 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Alterar status</p>
          {STATUSES.map((status) => (
            <button
              key={status}
              role="menuitemradio"
              aria-checked={menu.lead.status === status}
              className={cn(ui.menuItem, "justify-between py-1.5", menu.lead.status === status && "text-foreground font-semibold")}
              onClick={() => { onChangeStatus(menu.lead.id, status); setMenu(null); }}
            >
              {status}
              {menu.lead.status === status && <Check size={14} className="text-brand" />}
            </button>
          ))}
          <div className="border-t border-border my-1" />
          <button role="menuitem" className={ui.menuItem} onClick={() => { setMenu(null); confirmDelete(menu.lead); }}>
            <Trash2 size={16} /> Excluir
          </button>
        </div>
      )}
    </div>
  );
}
