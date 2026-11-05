import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "../../lib/utils";
import { ui } from "../../lib/ui";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  icon?: ReactNode;
  size?: "md" | "lg";
  children: ReactNode;
  footer?: ReactNode;
}

/** Diálogo acessível: Esc fecha, foco vai para o painel e volta ao gatilho, rolagem do fundo travada. */
export function Modal({ open, onClose, title, description, icon, size = "md", children, footer }: ModalProps) {
  const titleId = useId();
  const descId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);

  useEffect(() => {
    closeRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeRef.current();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className={cn(
          "relative w-full bg-card border border-border shadow-[var(--shadow-pop)] rounded-t-2xl sm:rounded-2xl max-h-[92dvh] flex flex-col focus:outline-none animate-pop-in",
          size === "lg" ? "sm:max-w-2xl" : "sm:max-w-lg"
        )}
      >
        <header className="flex items-start justify-between gap-4 px-6 pt-6 pb-4 border-b border-border">
          <div className="flex items-start gap-3 min-w-0">
            {icon && <div className={ui.iconBadge}>{icon}</div>}
            <div className="min-w-0">
              <h2 id={titleId} className="text-lg font-bold tracking-tight text-foreground">
                {title}
              </h2>
              {description && (
                <p id={descId} className="text-sm text-muted-foreground mt-0.5">
                  {description}
                </p>
              )}
            </div>
          </div>
          <button onClick={onClose} aria-label="Fechar" className={cn(ui.btnGhost, "w-10 h-10 shrink-0")}>
            <X size={18} />
          </button>
        </header>

        <div className="px-6 py-5 overflow-y-auto">{children}</div>

        {footer && (
          <footer className="px-6 py-4 border-t border-border flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-3 safe-pb sm:pb-4">
            {footer}
          </footer>
        )}
      </div>
    </div>
  );
}

