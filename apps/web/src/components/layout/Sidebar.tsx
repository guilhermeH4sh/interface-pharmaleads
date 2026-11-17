import { useEffect, type ComponentType } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Users, Calendar, Settings, BarChart3, HelpCircle, X } from "lucide-react";
import { Logo } from "../logo";
import { cn } from "../../lib/utils";
import { motionGestures, springPhysics, motionTransitions } from "../../lib/motion";

export type NavTab = "leads" | "crm" | "config" | "relatorios";

interface SidebarProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  onOpenHelp: () => void;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
}

const NAV_ITEMS: { id: NavTab; label: string; icon: ComponentType<{ size?: number; className?: string }> }[] = [
  { id: "leads", label: "Leads", icon: Users },
  { id: "crm", label: "CRM", icon: Calendar },
  { id: "config", label: "Configurações", icon: Settings },
  { id: "relatorios", label: "Relatórios", icon: BarChart3 },
];

const itemBase =
  "w-full flex items-center gap-3 px-4 h-11 rounded-xl text-sm font-medium transition-colors duration-200 select-none text-left";

export function Sidebar({ activeTab, onSelectTab, onOpenHelp, isOpenMobile = false, onCloseMobile }: SidebarProps) {
  // Esc fecha o drawer no mobile
  useEffect(() => {
    if (!isOpenMobile) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCloseMobile?.();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpenMobile, onCloseMobile]);

  const content = (
    <div className="flex flex-col h-full p-5">
      <div className="flex items-center justify-between h-12">
        <Logo size={38} />
        {isOpenMobile && onCloseMobile && (
          <motion.button
            whileTap={motionGestures.tap}
            onClick={onCloseMobile}
            aria-label="Fechar menu"
            className="lg:hidden w-10 h-10 inline-flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
          >
            <X size={20} />
          </motion.button>
        )}
      </div>

      <p className="mt-8 mb-2 px-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Menu</p>
      <nav className="flex flex-col gap-1" aria-label="Navegação principal">
        {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
          const isActive = activeTab === id;
          return (
            <motion.button
              key={id}
              whileTap={motionGestures.tap}
              whileHover={{ x: 2 }}
              transition={{ duration: 0.15 }}
              aria-current={isActive ? "page" : undefined}
              onClick={() => {
                onSelectTab(id);
                onCloseMobile?.();
              }}
              className={cn(
                itemBase,
                isActive
                  ? "bg-primary text-primary-foreground font-semibold shadow-[var(--shadow-primary)]"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              <Icon size={19} />
              <span>{label}</span>
            </motion.button>
          );
        })}
      </nav>

      <div className="mt-auto pt-4 border-t border-border space-y-3">
        <motion.button
          whileTap={motionGestures.tap}
          whileHover={{ x: 2 }}
          transition={{ duration: 0.15 }}
          onClick={onOpenHelp}
          className={cn(itemBase, "text-muted-foreground hover:text-foreground hover:bg-muted")}
        >
          <HelpCircle size={19} />
          <span>Ajuda</span>
        </motion.button>
        <p className="px-4 text-[11px] text-muted-foreground">© Centrus AI · Inteligência Farmacêutica</p>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop: menu compacto para liberar espaço para a área de trabalho */}
      <aside className="hidden lg:flex flex-col w-[220px] h-dvh fixed left-0 top-0 bg-card border-r border-border z-30">
        {content}
      </aside>

      {/* Mobile/tablet: drawer com AnimatePresence */}
      <AnimatePresence>
        {isOpenMobile && (
          <div className="lg:hidden fixed inset-0 z-50 flex">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={motionTransitions.fade}
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={onCloseMobile}
              aria-hidden="true"
            />
            <motion.aside
              role="dialog"
              aria-modal="true"
              aria-label="Menu de navegação"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={springPhysics.gentle}
              className="relative w-[248px] max-w-[85vw] h-full bg-card border-r border-border shadow-[var(--shadow-pop)]"
            >
              {content}
            </motion.aside>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
