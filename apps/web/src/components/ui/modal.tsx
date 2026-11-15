import { useEffect, useId, useRef, type ReactNode } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X } from "lucide-react";
import { cn } from "../../lib/utils";
import { ui } from "../../lib/ui";
import { modalVariants, motionTransitions, motionGestures } from "../../lib/motion";

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

/** Diálogo acessível com animação de física iOS: entrada com spring suave e saída natural. */
export function Modal({
  open,
  onClose,
  title,
  description,
  icon,
  size = "md",
  children,
  footer,
}: ModalProps) {
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

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={motionTransitions.fade}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden="true"
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={description ? descId : undefined}
            tabIndex={-1}
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className={cn(
              "relative w-full bg-card border border-border shadow-[var(--shadow-pop)] rounded-t-2xl sm:rounded-2xl max-h-[92dvh] flex flex-col focus:outline-none",
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
              <motion.button
                whileTap={motionGestures.tap}
                onClick={onClose}
                aria-label="Fechar"
                className={cn(ui.btnGhost, "w-10 h-10 shrink-0")}
              >
                <X size={18} />
              </motion.button>
            </header>

            <div className="px-6 py-5 overflow-y-auto">{children}</div>

            {footer && (
              <footer className="px-6 py-4 border-t border-border flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-3 safe-pb sm:pb-4">
                {footer}
              </footer>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
