import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { Check, ChevronDown } from "lucide-react";
import { ui } from "../../lib/ui";
import { cn } from "../../lib/utils";
import { motionTransitions, usePrefersReducedMotion } from "../../lib/motion";

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface SelectProps {
  id?: string;
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  ariaLabel?: string;
  placeholder?: string;
  disabled?: boolean;
  align?: "left" | "right";
  className?: string;
  triggerClassName?: string;
  menuClassName?: string;
}

const normalizeText = (text: string) =>
  text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

interface MenuPosition {
  top?: number;
  bottom?: number;
  left?: number;
  right?: number;
  minWidth: number;
  placement: "bottom" | "top";
}

export function Select({
  id,
  label,
  value,
  onChange,
  options,
  ariaLabel,
  placeholder = "Selecione...",
  disabled = false,
  align = "right",
  className,
  triggerClassName,
  menuClassName,
}: SelectProps) {
  const generatedId = useId();
  const triggerId = id || `${generatedId}-trigger`;
  const labelId = `${generatedId}-label`;
  const listboxId = `${generatedId}-listbox`;

  const reducedMotion = usePrefersReducedMotion();
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(() =>
    Math.max(
      0,
      options.findIndex((opt) => opt.value === value && !opt.disabled)
    )
  );
  const [position, setPosition] = useState<MenuPosition | null>(null);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  const optionRefs = useRef<(HTMLLIElement | null)[]>([]);
  const typeaheadRef = useRef<{ query: string; timer: number | null }>({
    query: "",
    timer: null,
  });

  const selectedOption = options.find((opt) => opt.value === value);

  const findEnabledIndex = useCallback(
    (startIndex: number, step: 1 | -1) => {
      if (options.length === 0) return -1;
      for (let offset = 0; offset < options.length; offset++) {
        const idx =
          (startIndex + offset * step + options.length) % options.length;
        if (!options[idx]?.disabled) return idx;
      }
      return -1;
    },
    [options]
  );

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const viewportWidth = document.documentElement.clientWidth || window.innerWidth;
    const viewportHeight = document.documentElement.clientHeight || window.innerHeight;
    const estimatedHeight = Math.min(options.length * 40 + 16, 280);
    const gap = 6;
    const margin = 12;

    const spaceBelow = viewportHeight - rect.bottom;
    const spaceAbove = rect.top;
    const openUpward = spaceBelow < estimatedHeight + gap && spaceAbove > spaceBelow;

    const nextPos: MenuPosition = {
      minWidth: rect.width,
      placement: openUpward ? "top" : "bottom",
    };

    if (openUpward) {
      nextPos.bottom = Math.max(margin, viewportHeight - rect.top + gap);
    } else {
      nextPos.top = Math.min(viewportHeight - margin, rect.bottom + gap);
    }

    if (align === "right") {
      nextPos.right = Math.max(margin, viewportWidth - rect.right);
    } else {
      nextPos.left = Math.max(margin, Math.min(rect.left, viewportWidth - rect.width - margin));
    }

    setPosition(nextPos);
  }, [align, options.length]);

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
  }, [open, updatePosition]);

  const closeMenu = useCallback((returnFocus = false) => {
    setOpen(false);
    if (returnFocus) {
      window.requestAnimationFrame(() => triggerRef.current?.focus());
    }
  }, []);

  // Fecha ao clicar fora, pressionar Esc, redimensionar ou rolar a página
  useEffect(() => {
    if (!open) return;

    const onMouseDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) {
        return;
      }
      closeMenu(false);
    };

    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeMenu(true);
      }
    };

    const onScroll = (event: Event) => {
      if (menuRef.current && event.target instanceof Node && menuRef.current.contains(event.target)) {
        return;
      }
      closeMenu(false);
    };

    const onResize = () => updatePosition();

    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);

    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [open, closeMenu, updatePosition]);

  useEffect(() => {
    if (!open || highlightedIndex < 0) return;
    const raf = window.requestAnimationFrame(() => {
      const item = optionRefs.current[highlightedIndex];
      if (item && typeof item.scrollIntoView === "function") {
        item.scrollIntoView({ block: "nearest" });
      }
    });
    return () => window.cancelAnimationFrame(raf);
  }, [open, highlightedIndex]);

  useEffect(() => {
    const typeahead = typeaheadRef.current;
    return () => {
      if (typeahead.timer !== null) window.clearTimeout(typeahead.timer);
    };
  }, []);

  const selectOption = useCallback(
    (option: SelectOption) => {
      if (option.disabled) return;
      onChange(option.value);
      closeMenu(true);
    },
    [onChange, closeMenu]
  );

  const openWithIndex = useCallback(
    (index: number) => {
      const clamped = Math.max(0, Math.min(options.length - 1, index));
      const nextIndex = findEnabledIndex(clamped, 1);
      setHighlightedIndex(nextIndex >= 0 ? nextIndex : 0);
      setOpen(true);
    },
    [options.length, findEnabledIndex]
  );

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (disabled || options.length === 0) return;

    const currentIdx = Math.max(
      0,
      options.findIndex((opt) => opt.value === value && !opt.disabled)
    );

    switch (event.key) {
      case "ArrowDown": {
        event.preventDefault();
        if (!open) {
          openWithIndex(currentIdx);
        } else {
          const next = findEnabledIndex(highlightedIndex + 1, 1);
          if (next >= 0) setHighlightedIndex(next);
        }
        break;
      }
      case "ArrowUp": {
        event.preventDefault();
        if (!open) {
          openWithIndex(currentIdx);
        } else {
          const prev = findEnabledIndex(highlightedIndex - 1, -1);
          if (prev >= 0) setHighlightedIndex(prev);
        }
        break;
      }
      case "Home": {
        event.preventDefault();
        const first = findEnabledIndex(0, 1);
        if (first >= 0) {
          if (!open) openWithIndex(first);
          else setHighlightedIndex(first);
        }
        break;
      }
      case "End": {
        event.preventDefault();
        const last = findEnabledIndex(options.length - 1, -1);
        if (last >= 0) {
          if (!open) openWithIndex(last);
          else setHighlightedIndex(last);
        }
        break;
      }
      case "Enter":
      case " ": {
        event.preventDefault();
        if (!open) {
          openWithIndex(currentIdx);
        } else {
          const target = options[highlightedIndex];
          if (target && !target.disabled) selectOption(target);
        }
        break;
      }
      case "Tab": {
        if (open) setOpen(false);
        break;
      }
      default: {
        if (
          event.key.length === 1 &&
          !event.ctrlKey &&
          !event.metaKey &&
          !event.altKey
        ) {
          event.preventDefault();
          const char = normalizeText(event.key);
          if (!char) break;
          if (typeaheadRef.current.timer !== null) {
            window.clearTimeout(typeaheadRef.current.timer);
          }
          const nextQuery = typeaheadRef.current.query + char;
          typeaheadRef.current.query = nextQuery;
          typeaheadRef.current.timer = window.setTimeout(() => {
            typeaheadRef.current.query = "";
            typeaheadRef.current.timer = null;
          }, 600);

          const start =
            nextQuery.length === 1
              ? (highlightedIndex + 1) % options.length
              : Math.max(0, highlightedIndex);

          const findMatch = (predicate: (opt: SelectOption) => boolean) => {
            for (let offset = 0; offset < options.length; offset++) {
              const idx = (start + offset) % options.length;
              const opt = options[idx];
              if (opt && !opt.disabled && predicate(opt)) return idx;
            }
            return -1;
          };

          const matchIdx =
            findMatch((opt) => normalizeText(opt.label).startsWith(nextQuery)) >= 0
              ? findMatch((opt) => normalizeText(opt.label).startsWith(nextQuery))
              : findMatch((opt) => normalizeText(opt.label).includes(nextQuery));

          if (matchIdx >= 0) {
            setHighlightedIndex(matchIdx);
            if (!open) setOpen(true);
          }
        }
        break;
      }
    }
  };

  const activeDescendantId = open ? `${listboxId}-option-${highlightedIndex}` : undefined;

  const menuNode =
    typeof document !== "undefined"
      ? createPortal(
          <AnimatePresence>
            {open && position && (
              <motion.ul
                ref={menuRef}
                id={listboxId}
                role="listbox"
                aria-labelledby={label ? labelId : undefined}
                aria-label={label ? undefined : ariaLabel}
                initial={
                  reducedMotion
                    ? { opacity: 0 }
                    : {
                        opacity: 0,
                        scale: 0.96,
                        y: position.placement === "bottom" ? -4 : 4,
                      }
                }
                animate={reducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
                exit={
                  reducedMotion
                    ? { opacity: 0 }
                    : {
                        opacity: 0,
                        scale: 0.97,
                        y: position.placement === "bottom" ? -4 : 4,
                      }
                }
                transition={
                  reducedMotion
                    ? { duration: 0.01 }
                    : { duration: 0.16, ease: motionTransitions.iosEase }
                }
                style={{
                  position: "fixed",
                  top: position.top,
                  bottom: position.bottom,
                  left: position.left,
                  right: position.right,
                  minWidth: position.minWidth,
                  maxWidth: "calc(100vw - 24px)",
                  transformOrigin:
                    position.placement === "bottom"
                      ? `top ${align}`
                      : `bottom ${align}`,
                }}
                className={cn(
                  ui.menu,
                  "z-[60] max-h-72 overflow-y-auto [scrollbar-width:thin] [scrollbar-color:var(--border)_transparent] bg-popover shadow-[var(--shadow-pop)] ring-1 ring-border/40 focus:outline-none",
                  menuClassName
                )}
              >
                {options.map((option, index) => {
                  const isSelected = option.value === value;
                  const isHighlighted = index === highlightedIndex;
                  const isOptionDisabled = Boolean(option.disabled);
                  return (
                    <li
                      key={option.value}
                      ref={(el) => {
                        optionRefs.current[index] = el;
                      }}
                      id={`${listboxId}-option-${index}`}
                      role="option"
                      aria-selected={isSelected}
                      aria-disabled={isOptionDisabled || undefined}
                      title={option.label}
                      onMouseEnter={() => {
                        if (!isOptionDisabled) setHighlightedIndex(index);
                      }}
                      onMouseDown={(event) => {
                        // Evita perder foco antes do click/seleção
                        event.preventDefault();
                      }}
                      onClick={() => selectOption(option)}
                      className={cn(
                        "flex items-center justify-between gap-2.5 px-2 py-2 min-h-9 rounded-lg text-sm select-none transition-colors duration-150",
                        isOptionDisabled
                          ? "opacity-50 cursor-not-allowed text-muted-foreground"
                          : isSelected
                            ? "bg-primary-soft text-brand font-semibold cursor-pointer"
                            : isHighlighted
                              ? "bg-muted text-foreground cursor-pointer"
                              : "text-foreground/90 hover:bg-muted cursor-pointer"
                      )}
                    >
                      <span className="leading-snug break-words">{option.label}</span>
                      {isSelected && (
                        <Check size={15} className="text-brand shrink-0" aria-hidden="true" />
                      )}
                    </li>
                  );
                })}
              </motion.ul>
            )}
          </AnimatePresence>,
          document.body
        )
      : null;

  const control = (
    <>
      <button
        ref={triggerRef}
        id={triggerId}
        type="button"
        role="combobox"
        aria-labelledby={label ? labelId : undefined}
        aria-label={label ? undefined : ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-activedescendant={activeDescendantId}
        disabled={disabled}
        onClick={() => {
          if (disabled) return;
          if (open) {
            setOpen(false);
          } else {
            openWithIndex(
              Math.max(
                0,
                options.findIndex((opt) => opt.value === value && !opt.disabled)
              )
            );
          }
        }}
        onKeyDown={handleKeyDown}
        className={cn(
          ui.input,
          "inline-flex items-center justify-between gap-2 text-left cursor-pointer select-none",
          open && "border-primary ring-2 ring-primary/20",
          triggerClassName
        )}
      >
        <span className="truncate">
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown
          size={16}
          aria-hidden="true"
          className={cn(
            "text-muted-foreground shrink-0 transition-transform duration-180 ease-[cubic-bezier(0.22,1,0.36,1)]",
            open && "rotate-180 text-brand"
          )}
        />
      </button>
      {menuNode}
    </>
  );

  if (!label && !className) {
    return control;
  }

  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      {label && (
        <label id={labelId} htmlFor={triggerId} className={ui.label}>
          {label}
        </label>
      )}
      {control}
    </div>
  );
}

