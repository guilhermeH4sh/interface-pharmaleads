import { memo } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { motion } from "motion/react";
import {
  GripVertical,
  Trash2,
  MessageCircle,
  ArrowLeft,
  ArrowRight,
} from "lucide-react";
import {
  springPhysics,
  motionGestures,
  motionTransitions,
  usePrefersReducedMotion,
} from "../../lib/motion";
import { cn } from "../../lib/utils";
import type { LeadItem, LeadStatus } from "../../lib/mock-leads";

export type CrmStage = Exclude<LeadStatus, "Não contatado">;

interface KanbanCardProps {
  lead: LeadItem;
  columnId: CrmStage;
  prevCol?: CrmStage | null;
  nextCol?: CrmStage | null;
  enterDirection?: "next" | "prev" | null;
  onSelectLead?: (lead: LeadItem) => void;
  onRemoveFromCrm?: (id: string) => void;
  onStatusChange?: (id: string, newStatus: CrmStage, direction?: "next" | "prev") => void;
  isOverlay?: boolean;
}

export const KanbanCard = memo(function KanbanCard({
  lead,
  columnId,
  prevCol,
  nextCol,
  enterDirection = null,
  onSelectLead,
  onRemoveFromCrm,
  onStatusChange,
  isOverlay = false,
}: KanbanCardProps) {
  const reducedMotion = usePrefersReducedMotion();

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: lead.id,
    data: {
      type: "card",
      lead,
      columnId,
    },
    transition: {
      duration: reducedMotion ? 0 : 200,
      easing: "cubic-bezier(0.22, 1, 0.36, 1)",
    },
    disabled: isOverlay,
  });

  const whatsappUrl = lead.whatsappLink;

  const isGhost = isDragging && !isOverlay;

  const sortableStyle = isOverlay
    ? undefined
    : {
        transform: CSS.Translate.toString(transform),
        transition,
      };

  // Conteúdo visual interno do Card — MESMO JSX e MESMAS classes base para card parado e overlay
  const cardContent = (
    <div
      className={cn(
        "p-3.5 rounded-xl border select-none transition-[border-color,box-shadow,background-color] duration-200",
        isOverlay
          ? "bg-surface border-border shadow-[var(--shadow-pop)] cursor-grabbing"
          : isGhost
            ? "bg-muted/65 border-border/80 opacity-60"
            : "bg-surface border-border hover:border-primary/50 hover:shadow-[var(--shadow-card)] cursor-grab active:cursor-grabbing"
      )}
      onClick={() => {
        if (!isDragging && !isOverlay && onSelectLead) {
          onSelectLead(lead);
        }
      }}
    >
      <div className={cn(isGhost && "invisible")}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-1.5 min-w-0">
            <span
              className="text-muted-foreground/60 hover:text-brand shrink-0 mt-0.5 p-0.5 touch-none"
              aria-hidden="true"
              title="Arraste para mover de etapa"
            >
              <GripVertical size={15} />
            </span>
            <h4 className="font-bold text-sm text-foreground hover:text-brand transition-colors line-clamp-1">
              {lead.nome}
            </h4>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-semibold">
              {lead.uf}
            </span>
            {onRemoveFromCrm && (
              <button
                type="button"
                aria-label={`Remover ${lead.nome} do CRM`}
                title="Remover do CRM (mantém o lead na base)"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation();
                  onRemoveFromCrm(lead.id);
                }}
                className="w-7 h-7 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-brand hover:bg-primary-soft transition-colors"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        </div>

        <p className="text-xs text-muted-foreground mt-1 pl-5 line-clamp-1">
          {lead.cidade} · {lead.categoria || "Drogaria"}
        </p>

        <div className="mt-3 pt-2.5 border-t border-border flex items-center justify-end text-xs pl-1">
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noreferrer"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            className="p-1.5 rounded-lg bg-primary-soft text-brand hover:bg-primary hover:text-primary-foreground transition-colors shrink-0"
            title="Abrir no WhatsApp"
          >
            <MessageCircle size={13} />
          </a>
        </div>

        {/* Atalhos Rápidos de Mover Etapa (Voltar / Avançar) */}
        {(prevCol || nextCol) && (
          <div className="mt-2.5 pt-2 border-t border-border/60 flex items-center justify-between gap-1.5">
            {prevCol ? (
              <motion.button
                type="button"
                whileTap={reducedMotion ? undefined : motionGestures.tap}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  onStatusChange?.(lead.id, prevCol, "prev");
                }}
                className="text-[11px] font-medium text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
              >
                <ArrowLeft size={11} /> Voltar
              </motion.button>
            ) : (
              <span />
            )}

            {nextCol && (
              <motion.button
                type="button"
                whileTap={reducedMotion ? undefined : motionGestures.tap}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  onStatusChange?.(lead.id, nextCol, "next");
                }}
                className="text-[11px] font-semibold text-brand hover:underline flex items-center gap-1 ml-auto transition-colors"
              >
                Avançar etapa <ArrowRight size={11} />
              </motion.button>
            )}
          </div>
        )}
      </div>
    </div>
  );

  // DragOverlay: mesmo card, apenas sombra elevada + escala sutil. Botões só visuais (inert).
  if (isOverlay) {
    return (
      <motion.div
        inert
        aria-hidden="true"
        initial={{ scale: 1 }}
        animate={reducedMotion ? { scale: 1 } : { scale: 1.02, transition: springPhysics.lift }}
        className="w-full h-full pointer-events-none will-change-transform"
      >
        {cardContent}
      </motion.div>
    );
  }

  const initialSlideX =
    !reducedMotion && enterDirection
      ? enterDirection === "next"
        ? -24
        : 24
      : 0;

  return (
    <div
      ref={setNodeRef}
      style={sortableStyle}
      {...attributes}
      aria-label={`Mover ${lead.nome}`}
      {...listeners}
      className={cn(
        "group",
        isDragging ? "touch-none" : "touch-manipulation"
      )}
    >
      <motion.div
        initial={
          enterDirection && !reducedMotion
            ? { opacity: 0.4, x: initialSlideX, scale: 0.98 }
            : false
        }
        animate={{ opacity: 1, x: 0, scale: 1 }}
        transition={
          reducedMotion
            ? { duration: 0.01 }
            : { duration: 0.22, ease: motionTransitions.iosEase }
        }
        whileHover={isDragging || reducedMotion ? undefined : { y: -1 }}
      >
        {cardContent}
      </motion.div>
    </div>
  );
});
