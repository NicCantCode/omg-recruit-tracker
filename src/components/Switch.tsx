import styles from "./Switch.module.css";
import type { SwitchProps } from "../lib/propsManager";

export default function Switch({ checked, onChange, label, ariaLabel, disabled = false, id }: SwitchProps) {
  const computedId = id ?? `switch_${(label ?? ariaLabel ?? "toggle").replace(/\s+/g, "_").toLowerCase()}`;

  return (
    <div className={`${styles.root} ${!label ? styles.rootNoLabel : ""} ${disabled ? styles.disabled : ""}`}>
      {label ? (
        <label className={styles.label} htmlFor={computedId}>
          {label}
        </label>
      ) : null}

      <button
        id={computedId}
        type="button"
        className={`${styles.switch} ${checked ? styles.on : styles.off}`}
        role="switch"
        aria-checked={checked}
        aria-label={ariaLabel ?? label ?? "Toggle"}
        disabled={disabled}
        onClick={() => {
          if (disabled) return;
          onChange(!checked);
        }}
      >
        <span className={styles.thumb} />
      </button>
    </div>
  );
}
