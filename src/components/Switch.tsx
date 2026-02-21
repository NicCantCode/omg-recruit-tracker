import styles from "./Switch.module.css";

import type { SwitchProps } from "../lib/propsManager";

export default function Switch({ checked, onChange, label, disabled = false, id }: SwitchProps) {
  const switchId = id ?? `switch_${label.replace(/\s+/g, "_").toLowerCase()}`;

  return (
    <div className={`${styles.root} ${disabled ? styles.disabled : ""}`}>
      <label className={styles.label} htmlFor={switchId}>
        {label}
      </label>

      <button
        id={switchId}
        type="button"
        className={`${styles.switch} ${checked ? styles.on : styles.off}`}
        role="switch"
        aria-checked={checked}
        aria-label={label}
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
