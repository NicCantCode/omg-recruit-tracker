import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { DropdownProps } from "../lib/propsManager";
import styles from "./Dropdown.module.css";

export type DropdownOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

type MenuPosition = {
  top: number;
  left: number;
  width: number;
};

export default function Dropdown({ value, options, onChange, disabled = false, ariaLabel, className }: DropdownProps) {
  const [open, setOpen] = useState<boolean>(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const [menuPos, setMenuPos] = useState<MenuPosition | null>(null);

  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  const selectedOption = useMemo(() => options.find((o) => o.value === value), [options, value]);

  const menuId = "dropdown_menu_portal";

  const close = (): void => {
    setOpen(false);
    setHighlightedIndex(-1);
  };

  const computeMenuPosition = (): void => {
    const trigger = triggerRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    setMenuPos({
      top: rect.bottom + 6,
      left: rect.left,
      width: rect.width,
    });
  };

  // When opening, compute position immediately (layout phase avoids "jump")
  useLayoutEffect(() => {
    if (!open) return;
    computeMenuPosition();
  }, [open]);

  // Keep menu pinned to trigger on scroll/resize
  useEffect(() => {
    if (!open) return;

    const onScrollOrResize = (): void => computeMenuPosition();

    // capture=true so it updates even when a scroll happens on an inner container
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);

    return () => {
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [open]);

  // Close on outside click (works with portal by checking both root + menu)
  useEffect(() => {
    if (!open) return;

    const onClick = (e: MouseEvent): void => {
      const target = e.target as Node;
      const root = rootRef.current;
      const menuEl = document.getElementById(menuId);

      const clickedInsideRoot = !!root?.contains(target);
      const clickedInsideMenu = !!menuEl?.contains(target);

      if (!clickedInsideRoot && !clickedInsideMenu) close();
    };

    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>): void => {
    if (disabled) return;

    if (!open && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      setOpen(true);
      setHighlightedIndex(
        Math.max(
          0,
          options.findIndex((o) => o.value === value),
        ),
      );
      return;
    }

    if (!open) return;

    switch (e.key) {
      case "Escape":
        close();
        break;

      case "ArrowDown":
        e.preventDefault();
        setHighlightedIndex((index) => Math.min(index + 1, options.length - 1));
        break;

      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex((index) => Math.max(index - 1, 0));
        break;

      case "Enter":
        e.preventDefault();
        if (highlightedIndex >= 0) {
          const option = options[highlightedIndex];
          if (!option.disabled) {
            onChange(option.value);
            close();
          }
        }
        break;
    }
  };

  const menu =
    open && menuPos
      ? createPortal(
          <ul
            id={menuId}
            className={styles.menuPortal}
            role="listbox"
            style={{
              top: `${menuPos.top}px`,
              left: `${menuPos.left}px`,
              width: `${menuPos.width}px`,
            }}
          >
            {options.map((option, index) => {
              const isSelected = option.value === value;
              const isHighlighted = index === highlightedIndex;

              return (
                <li
                  key={option.value}
                  role="option"
                  aria-selected={isSelected}
                  className={`${styles.option} ${isSelected ? styles.optionSelected : ""} ${
                    isHighlighted ? styles.optionHighlighted : ""
                  } ${option.disabled ? styles.optionDisabled : ""}`}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    if (option.disabled) return;
                    onChange(option.value);
                    close();
                  }}
                >
                  {option.label}
                </li>
              );
            })}
          </ul>,
          document.body,
        )
      : null;

  return (
    <>
      <div ref={rootRef} className={`${styles.root} ${disabled ? styles.disabled : ""} ${className ?? ""}`}>
        <button
          ref={triggerRef}
          type="button"
          className={styles.trigger}
          onClick={() => !disabled && setOpen((v) => !v)}
          onKeyDown={onKeyDown}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label={ariaLabel}
          disabled={disabled}
        >
          <span className={styles.triggerLabel}>{selectedOption?.label ?? "Select"}</span>
          <span className={styles.caret} aria-hidden>
            ▾
          </span>
        </button>
      </div>

      {menu}
    </>
  );
}
