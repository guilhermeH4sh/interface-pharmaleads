/**
 * Classes de UI reutilizáveis (design system Centrus: preto, roxo e branco).
 * Todas usam tokens semânticos definidos em styles.css, funcionando nos temas claro e escuro.
 */
export const ui = {
  card: "bg-card border border-border rounded-2xl shadow-[var(--shadow-card)] transition-colors duration-200",
  cardInteractive:
    "bg-card border border-border rounded-2xl shadow-[var(--shadow-card)] transition-all duration-200 hover:border-primary/40",

  btnPrimary:
    "inline-flex items-center justify-center gap-2 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary-hover active:scale-[0.98] transition-all duration-200 shadow-[var(--shadow-primary)] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100",
  btnBrand:
    "inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-primary-strong text-primary-foreground font-semibold shadow-[var(--shadow-primary)] hover:scale-[1.02] hover:brightness-110 active:scale-[0.98] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100",
  btnSecondary:
    "inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card text-foreground font-medium hover:bg-muted hover:border-primary/40 active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed",
  btnGhost:
    "inline-flex items-center justify-center gap-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors duration-150",
  iconBtn:
    "inline-flex items-center justify-center w-11 h-11 rounded-xl border border-border bg-card text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors duration-150",

  input:
    "h-11 w-full rounded-lg border border-input bg-card px-3.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
  label: "text-xs font-semibold text-muted-foreground",
  checkbox: "w-4 h-4 rounded border-input accent-primary cursor-pointer",

  menu: "bg-popover border border-border rounded-xl shadow-[var(--shadow-pop)] p-1.5 animate-pop-in",
  menuItem:
    "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted text-left transition-colors",

  pageTitle: "text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground",
  pageSubtitle: "text-sm text-muted-foreground mt-1.5",
  cardTitle: "text-base font-bold tracking-tight text-foreground flex items-center gap-2",
  iconBadge: "w-10 h-10 rounded-xl bg-primary-soft text-brand flex items-center justify-center shrink-0",
} as const;

