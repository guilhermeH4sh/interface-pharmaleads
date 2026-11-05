import React, { useState } from "react";
import { Search, Sparkles, Check } from "lucide-react";
import { getUFs, getMunicipios } from "../../lib/mock-leads";
import { Modal } from "../ui/modal";
import { ui } from "../../lib/ui";
import { cn } from "../../lib/utils";

interface NewProspectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartProspect: (data: { uf: string; municipio: string; origem: string }) => void;
}

export function NewProspectModal({ isOpen, onClose, onStartProspect }: NewProspectModalProps) {
  const [uf, setUf] = useState("SP");
  const [municipio, setMunicipio] = useState("");
  const [origem, setOrigem] = useState("Google Maps");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  const ufs = getUFs();
  const municipios = uf ? getMunicipios(uf) : [];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      setSuccessMsg("Prospecção solicitada com sucesso! Coletando dados...");
      setTimeout(() => {
        onStartProspect({ uf, municipio, origem });
        setSuccessMsg("");
        onClose();
      }, 1000);
    }, 500);
  };

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title="Nova Prospecção"
      description="Configure os parâmetros de varredura automatizada de farmácias."
      icon={<Sparkles size={18} />}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className={cn(ui.btnSecondary, "h-11 px-5 text-xs")}
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="new-prospect-form"
            disabled={isSubmitting}
            className={cn(ui.btnBrand, "h-11 px-6 text-sm")}
          >
            <Search size={16} />
            <span>{isSubmitting ? "Iniciando..." : "Iniciar prospecção"}</span>
          </button>
        </>
      }
    >
      <form id="new-prospect-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
        {successMsg && (
          <div className="p-3 rounded-xl bg-primary-soft border border-primary/25 text-xs text-brand font-semibold flex items-center gap-2">
            <Check size={15} /> {successMsg}
          </div>
        )}

        {/* UF */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="prospect-uf" className={ui.label}>
            UF Alvo
          </label>
          <select
            id="prospect-uf"
            value={uf}
            onChange={(e) => {
              setUf(e.target.value);
              setMunicipio("");
            }}
            required
            className={ui.input}
          >
            {ufs.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>

        {/* Município */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="prospect-municipio" className={ui.label}>
            Município Alvo
          </label>
          <select
            id="prospect-municipio"
            value={municipio}
            onChange={(e) => setMunicipio(e.target.value)}
            className={ui.input}
          >
            <option value="">Todos os municípios da UF</option>
            {municipios.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>

        {/* Origem da Coleta */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="prospect-origem" className={ui.label}>
            Canal / Origem
          </label>
          <select
            id="prospect-origem"
            value={origem}
            onChange={(e) => setOrigem(e.target.value)}
            className={ui.input}
          >
            <option value="Google Maps">Google Maps (Recomendado)</option>
            <option value="Google Meu Negócio">Google Meu Negócio</option>
            <option value="Outras fontes">Outras fontes / Bases Abertas</option>
          </select>
        </div>
      </form>
    </Modal>
  );
}
