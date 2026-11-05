import { HelpCircle, Database, Search, Shield, Cpu, ExternalLink } from "lucide-react";
import { Modal } from "../ui/modal";
import { ui } from "../../lib/ui";
import { cn } from "../../lib/utils";

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function HelpModal({ isOpen, onClose }: HelpModalProps) {
  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      size="lg"
      title="Central de Ajuda & Guia PharmaLeads"
      description="Inteligência Comercial e Prospecção Farmacêutica Centrus AI"
      icon={<HelpCircle size={18} />}
      footer={
        <div className="w-full flex items-center justify-between gap-3">
          <a
            href="https://centrusai.com"
            target="_blank"
            rel="noreferrer"
            className="text-xs text-brand hover:underline inline-flex items-center gap-1 font-semibold"
          >
            Conhecer mais sobre a Centrus AI <ExternalLink size={12} />
          </a>
          <button onClick={onClose} className={cn(ui.btnPrimary, "h-10 px-5 text-xs")}>
            Entendido
          </button>
        </div>
      }
    >
      <div className="space-y-3.5 text-xs text-muted-foreground leading-relaxed">
        <div className="p-4 rounded-xl bg-surface border border-border">
          <h3 className="font-bold text-foreground text-sm flex items-center gap-2 mb-1.5">
            <Search size={16} className="text-brand" /> Como funciona a Coleta de Leads
          </h3>
          <p>
            O PharmaLeads utiliza automação no Google Maps para extrair farmácias, drogarias,
            manipulações e distribuidoras em todo o território nacional. Cada registro inclui nome
            empresarial, telefone, endereço, avaliação e canais digitais.
          </p>
        </div>

        <div className="p-4 rounded-xl bg-surface border border-border">
          <h3 className="font-bold text-foreground text-sm flex items-center gap-2 mb-1.5">
            <Database size={16} className="text-brand" /> Dados & Supabase
          </h3>
          <p>
            A base de dados é mantida com sincronização bidirecional na tabela{" "}
            <code className="text-brand font-semibold">public.pharmaleads</code> do Supabase, com
            suporte a cache local SQLite e exportação contínua com encoding UTF-8 e proteção RLS.
          </p>
        </div>

        <div className="p-4 rounded-xl bg-surface border border-border">
          <h3 className="font-bold text-foreground text-sm flex items-center gap-2 mb-1.5">
            <Cpu size={16} className="text-brand" /> Enriquecimento com IA & Playwright
          </h3>
          <p>
            Quando ativado o enriquecimento, o sistema acessa os sites públicos das farmácias
            recém-coletadas para buscar números de WhatsApp adicionais, e-mails de compras e redes
            sociais para aceleração de conversão B2B.
          </p>
        </div>

        <div className="p-4 rounded-xl bg-surface border border-border">
          <h3 className="font-bold text-foreground text-sm flex items-center gap-2 mb-1.5">
            <Shield size={16} className="text-brand" /> Atalhos & Boas Práticas
          </h3>
          <ul className="list-disc pl-4 space-y-1 mt-1">
            <li>
              Use a tecla <strong className="text-foreground">Tab</strong> e{" "}
              <strong className="text-foreground">Enter</strong> para navegar pela tabela sem usar o
              mouse.
            </li>
            <li>Filtros e termos de busca são persistidos na URL para fácil compartilhamento.</li>
            <li>
              Acesse o WhatsApp do lead com apenas 1 clique no ícone na coluna de Telefone.
            </li>
          </ul>
        </div>
      </div>
    </Modal>
  );
}
