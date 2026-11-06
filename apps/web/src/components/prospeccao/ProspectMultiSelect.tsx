import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { ui } from "../../lib/ui";
import { cn } from "../../lib/utils";

interface Props {
  label: string;
  options: { value: string; label: string }[];
  values: string[];
  onChange: (values: string[]) => void;
}

export function ProspectMultiSelect({ label, options, values, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const root = useRef<HTMLDivElement>(null);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const outside = (event: MouseEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", outside);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("mousedown", outside); document.removeEventListener("keydown", escape); };
  }, [open]);
  const normalized = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const visible = options.filter(option => normalized(option.label).includes(normalized(query)));
  const selected = options.filter(option => values.includes(option.value));
  return (
    <div ref={root} className="relative min-w-0">
      <label id={`${id}-label`} className={cn(ui.label, "block mb-1.5")}>{label}</label>
      <button type="button" aria-labelledby={`${id}-label ${id}-value`} aria-expanded={open} aria-controls={`${id}-options`}
        onClick={() => setOpen(!open)} className={cn(ui.input, "flex items-center justify-between gap-2 text-left")}>
        <span id={`${id}-value`} className="truncate">{selected.length === 1 ? selected[0].label : selected.length ? `${selected.length} selecionados` : "Todos"}</span>
        <ChevronDown size={15} className="shrink-0 text-muted-foreground" />
      </button>
      {open && (
        <div id={`${id}-options`} role="group" aria-label={`Opções de ${label}`} className={cn(ui.menu, "absolute top-full left-0 mt-2 w-full min-w-[220px] max-w-[calc(100vw-3rem)] z-30 p-3")}>
          <input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar" aria-label={`Buscar em ${label}`} className={cn(ui.input, "h-9 mb-2")} />
          <div className="max-h-60 overflow-y-auto space-y-1">
            {visible.map(option => (
              <label key={option.value} className="flex items-start gap-2 rounded-lg p-2 text-xs cursor-pointer hover:bg-muted">
                <input type="checkbox" checked={values.includes(option.value)} className={cn(ui.checkbox, "shrink-0")}
                  onChange={() => onChange(values.includes(option.value) ? values.filter(value => value !== option.value) : [...values, option.value])} />
                {option.label}
              </label>
            ))}
            {!visible.length && <p className="p-2 text-xs text-muted-foreground">Nenhuma opção encontrada.</p>}
          </div>
          <button type="button" onClick={() => { onChange([]); setQuery(""); }} className="text-xs text-brand mt-2">Limpar seleção</button>
        </div>
      )}
    </div>
  );
}
