import { useEffect, useMemo, useRef } from "react";
import styles from "../../pages/Recruits.module.css";

import type { Recruit } from "../../lib/constants/recruit";
import type { Profile } from "../../lib/profile/profileTypes";

type Props = {
  isOpen: boolean;
  recruit: Recruit | null;
  creatorProfile?: Profile;
  onClose: () => void;
  onEdit?: () => void;
};

function pickCreatorName(profile: Profile | undefined): string {
  if (!profile) return "Unknown";
  if (profile.display_name_override && profile.display_name_override.trim().length > 0) return profile.display_name_override;
  if (profile.display_name && profile.display_name.trim().length > 0) return profile.display_name;
  if (profile.user_name && profile.user_name.trim().length > 0) return profile.user_name;
  return "Unknown";
}

function formatBirthday(birthday: string | null): string {
  if (!birthday) return "—";
  const t = Date.parse(birthday);
  if (Number.isNaN(t)) return birthday;
  return new Date(t).toLocaleDateString(undefined, { month: "short", day: "2-digit" });
}

function toTitleCase(value: string): string {
  return value
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export default function RecruitDetailsModal({ isOpen, recruit, creatorProfile, onClose, onEdit }: Props) {
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    dialogRef.current?.focus();
  }, [isOpen]);

  const creatorName = useMemo(() => pickCreatorName(creatorProfile), [creatorProfile]);

  const notesText = useMemo(() => {
    const raw = recruit?.notes ?? "";
    const trimmed = raw.trim();
    return trimmed.length > 0 ? trimmed : "";
  }, [recruit]);

  if (!isOpen || !recruit) return null;

  return (
    <div
      className={styles.modalOverlay}
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-label={`Recruit details for ${recruit.rs_name}`}
        tabIndex={-1}
      >
        <div className={styles.modalHeader}>
          <div>
            <div className={styles.modalTitle}>{recruit.rs_name}</div>
            <div style={{ fontSize: 12, opacity: 0.75, marginTop: 4 }}>
              Discord: <b>{recruit.discord_name ?? "—"}</b>
            </div>
          </div>

          <button className={styles.ghostButton} type="button" onClick={onClose}>
            Close
          </button>
        </div>

        <div style={{ padding: 14 }}>
          <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 12 }}>
            Added by <b>{creatorName}</b>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <div style={{ fontSize: 12, opacity: 0.7 }}>Status</div>
              <div style={{ fontSize: 14, fontWeight: 700, marginTop: 2 }}>{toTitleCase(recruit.status)}</div>
            </div>

            <div>
              <div style={{ fontSize: 12, opacity: 0.7 }}>Birthday</div>
              <div style={{ fontSize: 14, fontWeight: 700, marginTop: 2 }}>{formatBirthday(recruit.birthday)}</div>
            </div>

            <div>
              <div style={{ fontSize: 12, opacity: 0.7 }}>Joined</div>
              <div style={{ fontSize: 14, fontWeight: 700, marginTop: 2 }}>{recruit.joined_at ?? "Guest"}</div>
            </div>

            <div>
              <div style={{ fontSize: 12, opacity: 0.7 }}>Last Updated</div>
              <div style={{ fontSize: 14, fontWeight: 700, marginTop: 2 }}>{new Date(recruit.updated_at).toLocaleString()}</div>
            </div>
          </div>

          {notesText.length > 0 ? (
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>Notes</div>
              <div
                style={{
                  border: "1px solid rgba(255,255,255,0.08)",
                  background: "rgba(255,255,255,0.03)",
                  borderRadius: 12,
                  padding: 12,
                  minHeight: 64,
                  whiteSpace: "pre-wrap",
                  lineHeight: 1.4,
                }}
              >
                {notesText}
              </div>
            </div>
          ) : (
            <div style={{ marginTop: 14, fontSize: 13, opacity: 0.75 }}>No notes taken.</div>
          )}
        </div>

        <div className={styles.modalFooter}>
          {onEdit && (
            <button className={styles.primaryButton} type="button" onClick={onEdit} disabled={recruit.deleted_at !== null}>
              Edit
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
