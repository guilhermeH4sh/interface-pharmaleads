import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { Check, ChevronDown, Search } from "lucide-react";
import { ui } from "../../lib/ui";
import { cn } from "../../lib/utils";
import { motionTransitions, usePrefersReducedMotion } from "../../lib/motion";

/**
 * Padrão unificado de Dropdown (seleção única e múltipla):
 * - Gatilho: `ui.input` (`h-11`, `rounded-lg`, `border-input`, `bg-card`, `px-3.5`, `text-sm`), seta gira 180°.
 * - Painel (portal): `bg-popover`, `border-border`, `rounded-xl`, `shadow-[var(--shadow-pop)]`, `p-1.5` (6 px),
 *   largura igual à do gatilho, `gap` de 6 px, margem de viewport de 16 px e teto absoluto de 320 px.
 *   Só abre para cima se espaço abaixo < 200 px e espaço acima > espaço abaixo.
 * - Item: `h-10` (40 px), `px-2` (8 px -> 1 px borda + 6 px padding + 8 px item = 15 px, alinhado ao texto do gatilho),
 *   `rounded-lg`, `text-sm`, texto em linha única com `truncate` + `title`.
 * - Busca interna: ativa por padrão quando `options.length > 8` (ou via prop `searchable`), fixa fora da lista rolável.
 * - Rolagem: `.pl-scrollbar` restrita ao `<ul role="listbox">`.
 */
export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface BaseSelectProps {
  id?: string;
  label?: string;
  options: SelectOption[];
  ariaLabel?: string;
  placeholder?: string;
  disabled?: boolean;
  searchable?: boolean;
  searchPlaceholder?: string;
  clearable?: boolean;
  clearLabel?: string;
  align?: "left" | "right";
  className?: string;
  triggerClassName?: string;
  menuClassName?: string;
}

export interface SingleSelectProps extends BaseSelectProps {
  multiple?: false;
  value: string;
  onChange: (value: string) => void;
  values?: never;
}

export interface MultipleSelectProps extends BaseSelectProps {
  multiple: true;
  values: string[];
  onChange: (values: string[]) => void;
  value?: never;
}

export type SelectProps = SingleSelectProps | MultipleSelectProps;

interface MenuPosition {
  top?: number;
  bottom?: number;
  left?: number;
  right?: number;
  width: number;
  maxHeight: number;
  placement: "bottom" | "top";
}

const normalizeText = (text: string) =>
  text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

const PANEL_GAP = 6;
const VIEWPORT_MARGIN = 16;
const MAX_PANEL_HEIGHT = 320;
const MIN_USEFUL_SPACE_BELOW = 200;

export function Select(props: SelectProps) {
  const {
    id,
    label,
    options,
    ariaLabel,
    placeholder,
    disabled = false,
    searchable,
    searchPlaceholder = "Buscar...",
    clearable,
    clearLabel = "Limpar seleção",
    align = "left",
    className,
    triggerClassName,
    menuClassName,
  } = props;

  const isMultiple = props.multiple === true;
  const effectiveSearchable = searchable ?? options.length > 8;
  const effectiveClearable = clearable ?? isMultiple;
  const resolvedPlaceholder = placeholder ?? (isMultiple ? "Todos" : "Selecione...");

  const generatedId = useId();
  const triggerId = id || `${generatedId}-trigger`;
  const labelId = `${generatedId}-label`;
  const listboxId = `${generatedId}-listbox`;

  const reducedMotion = usePrefersReducedMotion();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState<number>(0);
  const [position, setPosition] = useState<MenuPosition | null>(null);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const optionRefs = useRef<(HTMLLIElement | null)[]>([]);
  const typeaheadRef = useRef<{ query: string; timer: number | null }>({
    query: "",
    timer: null,
  });

  const selectedValues = useMemo(
    () =>
      isMultiple
        ? props.values
        : props.value !== undefined && props.value !== null
          ? [props.value]
          : [],
    [isMultiple, props.values, props.value]
  );

  const selectedSet = useMemo(() => new Set(selectedValues), [selectedValues]);

  const visibleOptions = useMemo(() => {
    if (!effectiveSearchable || !query.trim()) return options;
    const normalizedQuery = normalizeText(query.trim());
    return options.filter((opt) => normalizeText(opt.label).includes(normalizedQuery));
  }, [effectiveSearchable, options, query]);

  const triggerDisplayLabel = useMemo(() => {
    if (isMultiple) {
      const selected = options.filter((opt) => selectedSet.has(opt.value));
      if (selected.length === 0) return resolvedPlaceholder;
      if (selected.length === 1) return selected[0].label;
      return `${selected.length} selecionados`;
    }
    const current = options.find((opt) => opt.value === props.value);
    return current ? current.label : resolvedPlaceholder;
  }, [isMultiple, options, props.value, resolvedPlaceholder, selectedSet]);

  const findEnabledIndex = useCallback(
    (list: SelectOption[], startIndex: number, step: 1 | -1) => {
      if (list.length === 0) return -1;
      for (let offset = 0; offset < list.length; offset++) {
        const idx = (startIndex + offset * step + list.length) % list.length;
        if (!list[idx]?.disabled) return idx;
      }
      return -1;
    },
    []
  );

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const viewportWidth = document.documentElement.clientWidth || window.innerWidth;
    const viewportHeight = document.documentElement.clientHeight || window.innerHeight;

    const spaceBelow = viewportHeight - rect.bottom - PANEL_GAP - VIEWPORT_MARGIN;
    const spaceAbove = rect.top - PANEL_GAP - VIEWPORT_MARGIN;
    const openUpward = spaceBelow < MIN_USEFUL_SPACE_BELOW && spaceAbove > spaceBelow;
    const availableHeight = openUpward ? spaceAbove : spaceBelow;
    const maxHeight = Math.max(120, Math.min(MAX_PANEL_HEIGHT, availableHeight));
    const width = Math.min(rect.width, Math.max(160, viewportWidth - VIEWPORT_MARGIN * 2));

    const nextPos: MenuPosition = {
      width,
      maxHeight,
      placement: openUpward ? "top" : "bottom",
    };

    if (openUpward) {
      nextPos.bottom = Math.max(VIEWPORT_MARGIN, viewportHeight - rect.top + PANEL_GAP);
    } else {
      nextPos.top = Math.min(viewportHeight - VIEWPORT_MARGIN, rect.bottom + PANEL_GAP);
    }

    if (align === "right") {
      const rightOffset = viewportWidth - rect.right;
      nextPos.right = Math.max(
        VIEWPORT_MARGIN,
        Math.min(rightOffset, viewportWidth - width - VIEWPORT_MARGIN)
      );
    } else {
      nextPos.left = Math.max(
        VIEWPORT_MARGIN,
        Math.min(rect.left, viewportWidth - width - VIEWPORT_MARGIN)
      );
    }

    setPosition(nextPos);
  }, [align]);

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
  }, [open, updatePosition]);

  const closeMenu = useCallback((returnFocus = false) => {
    setOpen(false);
    setQuery("");
    if (returnFocus) {
      window.requestAnimationFrame(() => triggerRef.current?.focus());
    }
  }, []);

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

  const handleSelectOption = useCallback(
    (option: SelectOption) => {
      if (option.disabled) return;
      if (props.multiple) {
        const nextValues = selectedSet.has(option.value)
          ? props.values.filter((v) => v !== option.value)
          : [...props.values, option.value];
        props.onChange(nextValues);
      } else {
        props.onChange(option.value);
        closeMenu(true);
      }
    },
    [props, selectedSet, closeMenu]
  );

  const handleClear = useCallback(() => {
    if (props.multiple) {
      props.onChange([]);
    } else {
      props.onChange("");
    }
    setQuery("");
  }, [props]);

  const openMenu = useCallback(() => {
    setQuery("");
    const firstSelectedIdx = options.findIndex(
      (opt) => selectedSet.has(opt.value) && !opt.disabled
    );
    const startIdx = firstSelectedIdx >= 0 ? firstSelectedIdx : findEnabledIndex(options, 0, 1);
    setHighlightedIndex(startIdx >= 0 ? startIdx : 0);
    setOpen(true);
  }, [options, selectedSet, findEnabledIndex]);

  const handleNavigationKey = (
    event: KeyboardEvent<HTMLElement>,
    allowTypeahead: boolean
  ) => {
    if (disabled || visibleOptions.length === 0) {
      if (event.key === "Tab" && open) closeMenu(false);
      return;
    }

    switch (event.key) {
      case "ArrowDown": {
        event.preventDefault();
        if (!open) {
          openMenu();
        } else {
          const next = findEnabledIndex(visibleOptions, highlightedIndex + 1, 1);
          if (next >= 0) setHighlightedIndex(next);
        }
        break;
      }
      case "ArrowUp": {
        event.preventDefault();
        if (!open) {
          openMenu();
        } else {
          const prev = findEnabledIndex(visibleOptions, highlightedIndex - 1, -1);
          if (prev >= 0) setHighlightedIndex(prev);
        }
        break;
      }
      case "Home": {
        event.preventDefault();
        const first = findEnabledIndex(visibleOptions, 0, 1);
        if (!open) openMenu();
        if (first >= 0) setHighlightedIndex(first);
        break;
      }
      case "End": {
        event.preventDefault();
        const last = findEnabledIndex(visibleOptions, visibleOptions.length - 1, -1);
        if (!open) openMenu();
        if (last >= 0) setHighlightedIndex(last);
        break;
      }
      case "Enter": {
        event.preventDefault();
        if (!open) {
          openMenu();
        } else {
          const target = visibleOptions[highlightedIndex];
          if (target && !target.disabled) handleSelectOption(target);
        }
        break;
      }
      case " ": {
        if (!allowTypeahead) return;
        event.preventDefault();
        if (!open) {
          openMenu();
        } else {
          const target = visibleOptions[highlightedIndex];
          if (target && !target.disabled) handleSelectOption(target);
        }
        break;
      }
      case "Tab": {
        if (open) closeMenu(false);
        break;
      }
      default: {
        if (
          allowTypeahead &&
          !effectiveSearchable &&
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
              ? (highlightedIndex + 1) % visibleOptions.length
              : Math.max(0, highlightedIndex);

          const findMatch = (predicate: (opt: SelectOption) => boolean) => {
            for (let offset = 0; offset < visibleOptions.length; offset++) {
              const idx = (start + offset) % visibleOptions.length;
              const opt = visibleOptions[idx];
              if (opt && !opt.disabled && predicate(opt)) return idx;
            }
            return -1;
          };

          const startsIdx = findMatch((opt) =>
            normalizeText(opt.label).startsWith(nextQuery)
          );
          const matchIdx =
            startsIdx >= 0
              ? startsIdx
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

  const activeDescendantId =
    open && visibleOptions[highlightedIndex]
      ? `${listboxId}-option-${highlightedIndex}`
      : undefined;

  const accessibleNameProps = label
    ? { "aria-labelledby": labelId }
    : ariaLabel
      ? { "aria-label": ariaLabel }
      : {};

  const menuNode =
    typeof document !== "undefined"
      ? createPortal(
          <AnimatePresence>
            {open && position && (
              <motion.div
                ref={menuRef}
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
                  width: position.width,
                  maxWidth: `calc(100vw - ${VIEWPORT_MARGIN * 2}px)`,
                  maxHeight: position.maxHeight,
                  transformOrigin:
                    position.placement === "bottom"
                      ? `top ${align}`
                      : `bottom ${align}`,
                }}
                className={cn(
                  ui.menu,
                  "z-[60] flex flex-col overflow-hidden bg-popover shadow-[var(--shadow-pop)] ring-1 ring-border/40",
                  menuClassName
                )}
              >
                {effectiveSearchable && (
                  <div className="relative mb-1.5 shrink-0">
                    <Search
                      size={14}
                      aria-hidden="true"
                      className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
                    />
                    <input
                      ref={searchInputRef}
                      type="search"
                      value={query}
                      onChange={(event) => {
                        setQuery(event.target.value);
                        setHighlightedIndex(0);
                      }}
                      onKeyDown={(event) => handleNavigationKey(event, false)}
                      placeholder={searchPlaceholder}
                      aria-label={`Buscar em ${label || ariaLabel || "opções"}`}
                      className={cn(ui.input, "h-9 pl-8 pr-2.5 text-sm")}
                    />
                  </div>
                )}

                <ul
                  id={listboxId}
                  role="listbox"
                  aria-multiselectable={isMultiple || undefined}
                  {...accessibleNameProps}
                  className="flex-1 min-h-0 overflow-y-auto pl-scrollbar space-y-0.5 focus:outline-none"
                >
                  {visibleOptions.map((option, index) => {
                    const isSelected = selectedSet.has(option.value);
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
                          event.preventDefault();
                        }}
                        onClick={() => handleSelectOption(option)}
                        className={cn(
                          "flex h-10 min-h-[40px] items-center gap-2.5 px-2 rounded-lg text-sm font-normal select-none transition-colors duration-150",
                          !isMultiple && "justify-between",
                          isOptionDisabled
                            ? "opacity-50 cursor-not-allowed text-muted-foreground"
                            : isSelected
                              ? "bg-primary-soft text-brand font-semibold cursor-pointer"
                              : isHighlighted
                                ? "bg-primary-soft/60 text-foreground cursor-pointer"
                                : "text-muted-foreground hover:bg-primary-soft/60 hover:text-foreground cursor-pointer"
                        )}
                      >
                        {isMultiple && (
                          <span
                            aria-hidden="true"
                            className={cn(
                              "flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border transition-colors duration-150",
                              isSelected
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-input bg-card"
                            )}
                          >
                            {isSelected && <Check size={12} strokeWidth={3} />}
                          </span>
                        )}
                        <span className="min-w-0 flex-1 truncate">{option.label}</span>
                        {!isMultiple && isSelected && (
                          <Check size={15} className="text-brand shrink-0" aria-hidden="true" />
                        )}
                      </li>
                    );
                  })}
                  {visibleOptions.length === 0 && (
                    <li className="px-2 py-3 text-center text-sm text-muted-foreground select-none">
                      Nenhum resultado encontrado.
                    </li>
                  )}
                </ul>

                {effectiveClearable && (
                  <div className="mt-1.5 pt-1.5 border-t border-border shrink-0">
                    <button
                      type="button"
                      disabled={selectedValues.length === 0}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={handleClear}
                      className="w-full rounded-lg px-2 py-1.5 text-left text-xs font-semibold text-brand transition-colors hover:bg-primary-soft/60 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {clearLabel}
                    </button>
                  </div>
                )}
              </motion.div>
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
        {...accessibleNameProps}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-activedescendant={activeDescendantId}
        disabled={disabled}
        onClick={() => {
          if (disabled) return;
          if (open) closeMenu(false);
          else openMenu();
        }}
        onKeyDown={(event) => handleNavigationKey(event, true)}
        className={cn(
          ui.input,
          "inline-flex items-center justify-between gap-2 text-left cursor-pointer select-none",
          open && "border-primary ring-2 ring-primary/20",
          triggerClassName
        )}
      >
        <span className="truncate">{triggerDisplayLabel}</span>
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
