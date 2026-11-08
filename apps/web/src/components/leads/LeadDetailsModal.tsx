import {
  ExternalLink,
  MapPin,
  Building,
  Globe,
  Mail,
  Phone,
  Star,
  ShieldCheck,
  Navigation,
  Clock,
} from "lucide-react";
import { formatCNPJ, formatPhone, buildWhatsAppLink } from "../../lib/formatters";
import { StatusBadge } from "./StatusBadge";
import { Modal } from "../ui/modal";
import { ui } from "../../lib/ui";
import { cn } from "../../lib/utils";
import type { LeadItem, LeadStatus } from "../../lib/mock-leads";
import { parseLeadEmails } from "../../lib/email";

interface LeadDetailsModalProps {
  lead: LeadItem | null;
  onClose: () => void;
  onChangeStatus: (leadId: string, status: LeadStatus) => void;
}

const SITUACAO_LABELS: Record<string, string> = {
  ativa_ou_desconhecida: "Ativa ou desconhecida",
  fechada_temporariamente: "Fechada temporariamente",
  fechada_permanentemente: "Fechada permanentemente",
  fechada: "Fechada",
};

export function LeadDetailsModal({ lead, onClose, onChangeStatus }: LeadDetailsModalProps) {
  if (!lead) return null;

  const emails = parseLeadEmails(lead.email);
  const whatsappUrl = lead.whatsappLink || buildWhatsAppLink(lead.telefone);

  return (
    <Modal
      open={Boolean(lead)}
      onClose={onClose}
      size="lg"
      title={lead.nome}
      description={
        lead.segmento
          ? `${lead.categoria || "Farmácia"} · Segmento: ${lead.segmento}`
          : lead.categoria || "Farmácia e Drogaria"
      }
      icon={<Building size={18} />}
      footer={
        <div className="w-full flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground font-medium">Alterar status:</span>
            <div className="flex items-center gap-1.5 flex-wrap">
              {(["Qualificado", "Em contato", "Respondido", "Não contatado"] as LeadStatus[]).map(
                (st) => (
                  <button
                    key={st}
                    onClick={() => onChangeStatus(lead.id, st)}
                    className={cn(
                      "px-3 py-1 rounded-full text-xs font-semibold transition-all border",
                      lead.status === st
                        ? "bg-primary text-primary-foreground border-primary shadow-[var(--shadow-primary)]"
                        : "bg-muted text-muted-foreground border-border hover:text-foreground hover:border-primary/40"
                    )}
                  >
                    {st}
                  </button>
                )
              )}
            </div>
          </div>

          <button onClick={onClose} className={cn(ui.btnSecondary, "h-10 px-5 text-xs")}>
            Fechar
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Status Atual:
            </span>
            <StatusBadge status={lead.status} />
          </div>

          {lead.link && (
            <a
              href={lead.link}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand hover:underline"
            >
              <Navigation size={13} /> Abrir no Google Maps <ExternalLink size={12} />
            </a>
          )}
        </div>

        {/* Grade de Informações */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 text-sm">
          {/* CNPJ / Identificador */}
          <div className="p-3.5 rounded-xl bg-surface border border-border">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
              CNPJ / Registro
            </span>
            <span className="font-mono text-foreground font-semibold">{formatCNPJ(lead.cnpj)}</span>
          </div>

          {/* Localização */}
          <div className="p-3.5 rounded-xl bg-surface border border-border">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1">
              <MapPin size={12} className="text-brand" /> Localidade
            </span>
            <span className="text-foreground font-medium">
              {lead.cidade} / {lead.uf} {lead.bairro ? `· ${lead.bairro}` : ""}
            </span>
          </div>

          {/* Telefone e WhatsApp */}
          <div className="p-3.5 rounded-xl bg-surface border border-border">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1">
              <Phone size={12} className="text-brand" /> Telefone de Contato
            </span>
            <div className="flex items-center justify-between gap-2">
              <span className="text-foreground font-medium tabular-nums">
                {formatPhone(lead.telefone)}
              </span>
              {whatsappUrl && (
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-brand hover:underline font-semibold"
                >
                  Abrir WhatsApp <ExternalLink size={12} />
                </a>
              )}
            </div>
          </div>

          {/* Responsável */}
          <div className="p-3.5 rounded-xl bg-surface border border-border">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1">
              <ShieldCheck size={12} className="text-brand" /> Responsável Comercial
            </span>
            <span className="text-foreground font-medium">
              {lead.responsavel || "Comercial Centrus"}
            </span>
          </div>

          {/* Endereço Completo */}
          <div className="p-3.5 rounded-xl bg-surface border border-border md:col-span-2">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
              Endereço Completo
            </span>
            <span className="text-foreground text-xs">
              {lead.endereco || `${lead.bairro}, ${lead.cidade} - ${lead.uf}`}
            </span>
          </div>

          {/* Site */}
          {lead.site && (
            <div className="p-3.5 rounded-xl bg-surface border border-border">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1">
                <Globe size={12} className="text-brand" /> Website
              </span>
              <a
                href={lead.site}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-brand hover:underline truncate block font-medium"
              >
                {lead.site}
              </a>
            </div>
          )}

          {/* E-mail sempre visível, inclusive quando ainda não foi coletado */}
          <div className="p-3.5 rounded-xl bg-surface border border-border">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1">
              <Mail size={12} className="text-brand" /> E-mail
            </span>
            {emails.length ? (
              <div className="space-y-1">
                {emails.map(email => (
                  <a key={email} href={`mailto:${email}`} className="text-xs text-foreground hover:text-brand hover:underline break-all block">
                    {email}
                  </a>
                ))}
              </div>
            ) : (
              <span className="text-xs text-muted-foreground">Não informado</span>
            )}
          </div>

          {/* Avaliação Google */}
          {lead.avaliacao != null && (
            <div className="p-3.5 rounded-xl bg-surface border border-border">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1">
                <Star size={12} className="text-brand fill-current" /> Reputação Google
              </span>
              <span className="text-foreground text-xs font-semibold">
                {lead.avaliacao} ★ ({lead.qtdAvaliacoes || 0} avaliações)
              </span>
            </div>
          )}

          {/* Origem & Situação */}
          <div className="p-3.5 rounded-xl bg-surface border border-border">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
              Origem & Situação
            </span>
            <span className="text-foreground text-xs font-medium">
              {lead.origem}
              {lead.situacao ? ` · ${SITUACAO_LABELS[lead.situacao] || lead.situacao}` : ""}
            </span>
          </div>

          {/* Última Coleta */}
          {lead.ultimaColeta && (
            <div className="p-3.5 rounded-xl bg-surface border border-border md:col-span-2">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1">
                <Clock size={12} className="text-brand" /> Última Coleta Sincronizada
              </span>
              <span className="text-foreground text-xs font-mono">
                {new Date(lead.ultimaColeta).toLocaleString("pt-BR")}
              </span>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
