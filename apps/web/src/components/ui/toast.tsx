import { useEffect } from "react";
import { AlertCircle, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { springPhysics, usePrefersReducedMotion } from "../../lib/motion";

export interface ToastMessage {
  id: number;
  message: string;
}

interface ToastProps {
  toast: ToastMessage | null;
  onDismiss: () => void;
  durationMs?: number;
}

/**
 * Toast flutuante discreto para feedback imediato (ex.: erro e reversão otimista no Kanban).
 */
export function Toast({ toast, onDismiss, durationMs = 5000 }: ToastProps) {
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(onDismiss, durationMs);
    return () => window.clearTimeout(timer);
  }, [toast, onDismiss, durationMs]);

  return (
    <div
      className="fixed bottom-5 right-5 z-50 max-w-sm w-[calc(100vw-2.5rem)] pointer-events-none"
      aria-live="assertive"
    >
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.id}
            role="alert"
            initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.96 }}
            animate={reducedMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
            exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 10, scale: 0.97 }}
            transition={reducedMotion ? { duration: 0.12 } : springPhysics.snappy}
            className="pointer-events-auto flex items-start gap-3 rounded-2xl border border-primary/40 bg-card text-foreground p-4 shadow-[var(--shadow-pop)] ring-1 ring-border"
          >
            <span className="w-8 h-8 rounded-xl bg-primary-soft text-brand flex items-center justify-center shrink-0">
              <AlertCircle size={17} aria-hidden="true" />
            </span>
            <p className="text-xs sm:text-sm font-medium leading-snug flex-1 pt-0.5">
              {toast.message}
            </p>
            <button
              type="button"
              onClick={onDismiss}
              aria-label="Fechar aviso"
              className="w-7 h-7 rounded-lg inline-flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
            >
              <X size={15} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

