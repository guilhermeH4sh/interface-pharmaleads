import React, { useState } from "react";
import { Search, Sparkles } from "lucide-react";
import { Modal } from "../ui/modal";
import { ui } from "../../lib/ui";
import { cn } from "../../lib/utils";

const UFS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA",
  "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN",
  "RS", "RO", "RR", "SC", "SP", "SE", "TO",
];

interface NewProspectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartProspect: (data: { uf: string; municipio: string; origem: string }) => void;
}

export function NewProspectModal({ isOpen, onClose, onStartProspect }: NewProspectModalProps) {
  const [uf, setUf] = useState("SP");
  const [municipio, setMunicipio] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onStartProspect({ uf, municipio, origem: "Google Maps" });
    onClose();
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
            className={cn(ui.btnSecondary, "h-11 px-5 text-xs")}
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="new-prospect-form"
            disabled={!municipio}
            className={cn(ui.btnBrand, "h-11 px-6 text-sm")}
          >
            <Search size={16} />
            <span>Iniciar prospecção</span>
          </button>
        </>
      }
    >
      <form id="new-prospect-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
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
            {UFS.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>

        {/* Município */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="prospect-municipio" className={ui.label}>
            Cidade ou bairro
          </label>
          <input
            id="prospect-municipio"
            value={municipio}
            onChange={(e) => setMunicipio(e.target.value)}
            placeholder="Ex.: São Paulo ou Pinheiros"
            required
            className={ui.input}
          />
        </div>

        <p className="text-xs text-muted-foreground">
          A busca será executada pelo Gosom no Google Maps, usando os segmentos e a profundidade configurados na Central de Prospecção.
        </p>
      </form>
    </Modal>
  );
}
