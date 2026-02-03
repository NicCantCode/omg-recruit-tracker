import { useEffect, useRef, useState } from "react";
import type { DropdownProps } from "../lib/propsManager";
import styles from "./Dropdown.module.css";

export type DropdownOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

export default function Dropdown({ value, options, onChange, disabled = false, ariaLabel }: DropdownProps) {
  const [open, setOpen] = useState<boolean>(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);

  const rootRef = useRef<HTMLDivElement | null>(null);

  const selectedOption = options.find((option) => option.value === value);

  // Close on outside click
  useEffect(() => {
    if (!open) return;

    const onClick = (e: MouseEvent): void => {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  // Keyboard navigation handling
  const onKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>): void => {
    if (disabled) return;

    if (!open && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      setOpen(true);
      setHighlightedIndex(
        Math.max(
          0,
          options.findIndex((option) => option.value === value),
        ),
      );
      return;
    }

    if (!open) return;

    switch (e.key) {
      case "Escape":
        setOpen(false);
        break;

      case "ArrowDown":
        e.preventDefault();
        setHighlightedIndex((index) => Math.min(index - 1, options.length - 1));
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
            setOpen(false);
          }
        }
        break;
    }
  };

  return (
    <div ref={rootRef} className={`${styles.root} ${disabled ? styles.disabled : ""}`}>
      <button
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

      {open ? (
        <ul className={styles.menu} role="listbox">
          {options.map((option, index) => {
            const isSelected = option.value === value;
            const isHighlighted = index === highlightedIndex;

            return (
              <li
                key={option.value}
                role="option"
                aria-selected={isSelected}
                className={`${styles.option} ${isSelected ? styles.optionSelected : ""} ${isHighlighted ? styles.optionHighlighted : ""} ${option.disabled ? styles.optionDisabled : ""}`}
                onMouseEnter={() => setHighlightedIndex(index)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  if (option.disabled) return;
                  onChange(option.value);
                  setOpen(false);
                }}
              >
                {option.label}
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
