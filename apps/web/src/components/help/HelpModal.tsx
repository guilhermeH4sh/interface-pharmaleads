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
            Escolha um estado ou Todas as UFs e clique em Aplicar filtros para consultar os leads já
            salvos. A coleta automática percorre cidades das 27 UFs às 07h, 13h e 19h, no horário
            de Brasília. Nome, telefone, endereço e canais digitais são preenchidos quando disponíveis.
          </p>
        </div>

        <div className="p-4 rounded-xl bg-surface border border-border">
          <h3 className="font-bold text-foreground text-sm flex items-center gap-2 mb-1.5">
            <Database size={16} className="text-brand" /> Dados & Supabase
          </h3>
          <p>
            Os leads salvos ficam disponíveis para pesquisa, filtros e inclusão no CRM.
            A exportação em CSV inclui todos os resultados do recorte escolhido, inclusive os
            que estão em outras páginas. Leads sem e-mail também podem fazer parte da base.
          </p>
        </div>

        <div className="p-4 rounded-xl bg-surface border border-border">
          <h3 className="font-bold text-foreground text-sm flex items-center gap-2 mb-1.5">
            <Cpu size={16} className="text-brand" /> Verificação dos contatos
          </h3>
          <p>
            A pesquisa do catálogo não inicia coleta nem verificação. Encontrar um telefone
            não comprova que ele tem WhatsApp ativo. A confirmação de WhatsApp é registrada
            separadamente, após a verificação manual do número.
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
