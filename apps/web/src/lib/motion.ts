import { useEffect, useState } from "react";
import type { Transition, Variants } from "motion/react";

/**
 * Tokens centrais de física e movimento — estilo iOS fluido
 * Utilizados no Kanban e em todos os componentes para consistência global.
 */

// Molas (Springs) físicas iOS
export const springPhysics = {
  // Ao soltar ou assentar um card: overshoot sutil e natural, sem quicar excessivamente
  settle: {
    type: "spring",
    stiffness: 350,
    damping: 26,
    mass: 1,
  } as const satisfies Transition,

  // Ao levantar um card durante o arraste: resposta imediata e tátil
  lift: {
    type: "spring",
    stiffness: 380,
    damping: 28,
    mass: 0.9,
  } as const satisfies Transition,

  // Microinterações rápidas (badges numéricos com pop, botões, ícones)
  snappy: {
    type: "spring",
    stiffness: 420,
    damping: 28,
    mass: 0.8,
  } as const satisfies Transition,

  // Transições suaves de painéis e modais
  gentle: {
    type: "spring",
    stiffness: 300,
    damping: 28,
    mass: 1,
  } as const satisfies Transition,
};

// Curvas de Bezier e durações padrão
export const motionTransitions = {
  iosEase: [0.22, 1, 0.36, 1] as const,
  durationFast: 0.2,
  durationNormal: 0.28,
  durationSlow: 0.35,

  smooth: {
    duration: 0.28,
    ease: [0.22, 1, 0.36, 1],
  } as const satisfies Transition,

  fade: {
    duration: 0.2,
    ease: "easeOut",
  } as const satisfies Transition,
};

// Configurações de escala tátil para interações de ponteiro
export const motionGestures = {
  tap: { scale: 0.97 },
  hover: { scale: 1.02 },
  dragOverlay: { scale: 1.04, rotate: 1.5 },
};

// Variantes para Modais e Diálogos
export const modalVariants: Variants = {
  hidden: {
    opacity: 0,
    scale: 0.96,
    y: 8,
  },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: springPhysics.gentle,
  },
  exit: {
    opacity: 0,
    scale: 0.97,
    y: 6,
    transition: { duration: 0.18, ease: [0.22, 1, 0.36, 1] },
  },
};

// Variantes para Menus e Dropdowns
export const dropdownVariants: Variants = {
  hidden: {
    opacity: 0,
    scale: 0.95,
    y: -6,
  },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: springPhysics.snappy,
  },
  exit: {
    opacity: 0,
    scale: 0.96,
    y: -4,
    transition: { duration: 0.15, ease: [0.22, 1, 0.36, 1] },
  },
};

// Variantes para Badges com Transição Numérica (Pop)
export const counterPopVariants: Variants = {
  initial: { scale: 0.8, opacity: 0.6 },
  animate: { scale: 1, opacity: 1, transition: springPhysics.snappy },
};

// Hook que monitora a preferência do sistema por redução de movimento
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return false;
    }
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = (event: MediaQueryListEvent) => setReduced(event.matches);
    mediaQuery.addEventListener("change", onChange);
    return () => mediaQuery.removeEventListener("change", onChange);
  }, []);

  return reduced;
}

