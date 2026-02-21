import { useMemo, useRef, useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import styles from "./RecruitUpsertModal.module.css";

import type { RecruitStatus } from "../../lib/constants/recruitStatuses";
import { RECRUIT_STATUSES } from "../../lib/constants/recruitStatuses";

import type { RecruitUpsertModalProps } from "../../lib/propsManager";
import type { Recruit } from "../../lib/constants/recruit";

import Dropdown from "../Dropdown";
import type { DropdownOption } from "../Dropdown";

const ANIM_MS = 180; // keep in sync with CSS transition duration

function toTitleCase(value: string): string {
  return value
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function normalize(value: string): string {
  return value.trim();
}

function validateBirthday(value: string): string | null {
  if (value.length === 0) return null;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return "Birthday must be a valid date (YYYY-MM-DD).";

  const t = Date.parse(value);
  if (Number.isNaN(t)) return "Birthday must be a valid date.";

  return null;
}

type FormProps = RecruitUpsertModalProps & {
  statusOptions: RecruitStatus[];
};

function RecruitUpsertForm(props: FormProps) {
  const { onClose, onSaved, mode, statusOptions } = props;

  const initial = useMemo(() => {
    if (mode === "edit") {
      const recruit = props.initialRecruit;
      return {
        rsName: recruit.rs_name ?? "",
        discordName: recruit.discord_name ?? "",
        status: recruit.status,
        birthday: recruit.birthday ?? "",
        notes: recruit.notes ?? "",
      };
    }

    return {
      rsName: "",
      discordName: "",
      status: statusOptions[0],
      birthday: "",
      notes: "",
    };
    // key-based remount handles reset on reopen
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const statusDropdownOptions: DropdownOption[] = useMemo(() => {
    return statusOptions.map((s) => ({
      value: s,
      label: toTitleCase(s),
    }));
  }, [statusOptions]);

  const [rsName, setRsName] = useState<string>(initial.rsName);
  const [discordName, setDiscordName] = useState<string>(initial.discordName);
  const [status, setStatus] = useState<RecruitStatus>(initial.status);
  const [birthday, setBirthday] = useState<string>(initial.birthday);
  const [notes, setNotes] = useState<string>(initial.notes);

  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [formError, setFormError] = useState<string>("");

  const baselineRef = useRef({
    rsName: initial.rsName,
    discordName: initial.discordName,
    status: initial.status,
    birthday: initial.birthday,
    notes: initial.notes,
  });

  function isDirty(): boolean {
    const b = baselineRef.current;
    return rsName !== b.rsName || discordName !== b.discordName || status !== b.status || birthday !== b.birthday || notes !== b.notes;
  }

  function requestClose(): void {
    if (isSaving) return;

    if (isDirty()) {
      const ok = window.confirm("You have unsaved changes. Discard them?");
      if (!ok) return;
    }

    onClose();
  }

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") requestClose();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSaving, rsName, discordName, status, birthday, notes]);

  async function onSubmit(): Promise<void> {
    setFormError("");

    const nextRs = normalize(rsName);
    if (nextRs.length === 0) {
      setFormError("RS Name is required.");
      return;
    }

    const birthdayTrimmed = normalize(birthday);
    const birthdayError = validateBirthday(birthdayTrimmed);
    if (birthdayError) {
      setFormError(birthdayError);
      return;
    }

    setIsSaving(true);

    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) {
        setFormError(userError.message);
        setIsSaving(false);
        return;
      }

      const userId = userData.user?.id;
      if (!userId) {
        setFormError("You must be signed in to do that.");
        setIsSaving(false);
        return;
      }

      const nowIso = new Date().toISOString();

      if (mode === "create") {
        const payload = {
          rs_name: nextRs,
          discord_name: normalize(discordName).length ? normalize(discordName) : null,
          status,
          birthday: birthdayTrimmed.length ? birthdayTrimmed : null,
          notes: normalize(notes).length ? normalize(notes) : null,
          created_by: userId,
          created_at: nowIso,
          updated_at: nowIso,
          deleted_at: null,
        };

        const { data, error } = await supabase
          .from("recruits")
          .insert(payload)
          .select("id, rs_name, discord_name, status, birthday, notes, created_by, created_at, updated_at, deleted_at")
          .single();

        if (error) {
          setFormError(error.message);
          setIsSaving(false);
          return;
        }

        const created = data as Recruit;

        baselineRef.current = {
          rsName: created.rs_name ?? "",
          discordName: created.discord_name ?? "",
          status: created.status,
          birthday: created.birthday ?? "",
          notes: created.notes ?? "",
        };

        setRsName(created.rs_name ?? "");
        setDiscordName(created.discord_name ?? "");
        setStatus(created.status);
        setBirthday(created.birthday ?? "");
        setNotes(created.notes ?? "");

        onSaved({ recruit: created, message: "Saved!" });
        setIsSaving(false);
        return;
      }

      const recruitId = props.initialRecruit.id;

      const updatePayload = {
        rs_name: nextRs,
        discord_name: normalize(discordName).length ? normalize(discordName) : null,
        status,
        birthday: birthdayTrimmed.length ? birthdayTrimmed : null,
        notes: normalize(notes).length ? normalize(notes) : null,
        updated_at: nowIso,
      };

      const { data, error } = await supabase
        .from("recruits")
        .update(updatePayload)
        .eq("id", recruitId)
        .select("id, rs_name, discord_name, status, birthday, notes, created_by, created_at, updated_at, deleted_at")
        .single();

      if (error) {
        setFormError(error.message);
        setIsSaving(false);
        return;
      }

      const updated = data as Recruit;

      baselineRef.current = {
        rsName: updated.rs_name ?? "",
        discordName: updated.discord_name ?? "",
        status: updated.status,
        birthday: updated.birthday ?? "",
        notes: updated.notes ?? "",
      };

      setRsName(updated.rs_name ?? "");
      setDiscordName(updated.discord_name ?? "");
      setStatus(updated.status);
      setBirthday(updated.birthday ?? "");
      setNotes(updated.notes ?? "");

      onSaved({ recruit: updated, message: "Saved!" });
      setIsSaving(false);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Unknown Error.");
      setIsSaving(false);
    }
  }

  const title = mode === "create" ? "Add Recruit" : "Edit Recruit";
  const primaryText = mode === "create" ? "Create" : "Save";

  return (
    <>
      <div className={styles.flyoutHeader}>
        <div className={styles.flyoutTitle}>{title}</div>
        <button className={styles.iconButton} type="button" onClick={requestClose} aria-label="Close">
          ✕
        </button>
      </div>

      {formError && (
        <div className={styles.modalError}>
          <div className={styles.errorTitle}>There was an error:</div>
          <div className={styles.modalErrorText}>{formError}</div>
        </div>
      )}

      <div className={styles.formGrid}>
        <div className={styles.control}>
          <label className={styles.label} htmlFor="rs_name">
            RS Name
          </label>
          <input
            id="rs_name"
            className={styles.input}
            value={rsName}
            onChange={(e) => setRsName(e.target.value)}
            placeholder="Example: NicCantCode"
            autoFocus
          />
        </div>

        <div className={styles.control}>
          <label className={styles.label} htmlFor="discord_name">
            Discord Name
          </label>
          <input
            id="discord_name"
            className={styles.input}
            value={discordName}
            onChange={(e) => setDiscordName(e.target.value)}
            placeholder="Example: indi_1313"
          />
        </div>

        <div className={styles.control}>
          <label className={styles.label} htmlFor="status_dropdown">
            Status
          </label>
          <Dropdown
            className={styles.dropdownFullWidth}
            value={status}
            options={statusDropdownOptions}
            ariaLabel="Recruit status"
            onChange={(v) => setStatus(v as RecruitStatus)}
          />
        </div>

        <div className={styles.control}>
          <label className={styles.label} htmlFor="birthday">
            Birthday
          </label>
          <input
            id="birthday"
            className={styles.dateInput}
            type="date"
            value={birthday}
            onChange={(e) => setBirthday(e.target.value)}
            aria-label="Birthday date picker"
          />
        </div>

        <div className={styles.control} style={{ gridColumn: "1 / -1" }}>
          <label className={styles.label} htmlFor="notes">
            Notes
          </label>
          <textarea
            id="notes"
            className={styles.textarea}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional notes…"
            rows={4}
          />
        </div>
      </div>

      <div className={styles.flyoutFooter}>
        <button className={styles.ghostButton} type="button" onClick={requestClose} disabled={isSaving}>
          Cancel
        </button>

        <button className={styles.primaryButton} type="button" onClick={() => void onSubmit()} disabled={isSaving}>
          {isSaving ? "Saving…" : primaryText}
        </button>
      </div>
    </>
  );
}

export default function RecruitUpsertModal(props: RecruitUpsertModalProps) {
  const statusOptions = useMemo(() => [...RECRUIT_STATUSES] as RecruitStatus[], []);

  // We keep it mounted while animating out
  const [isMounted, setIsMounted] = useState<boolean>(false);
  const [phase, setPhase] = useState<"preopen" | "open" | "closing">("preopen");

  const closeTimerRef = useRef<number | null>(null);
  const openTimerRef = useRef<number | null>(null);

  useEffect(() => {
    // cleanup timers
    return () => {
      if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);
      if (openTimerRef.current !== null) window.clearTimeout(openTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (props.isOpen) {
      // cancel any closing unmount
      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }

      // Mount first (async), then animate in on next frame
      openTimerRef.current = window.setTimeout(() => {
        setIsMounted(true);
        setPhase("preopen");

        requestAnimationFrame(() => {
          setPhase("open");
        });
      }, 0);

      return;
    }

    // closing
    if (!props.isOpen && isMounted) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPhase("closing");

      if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);

      closeTimerRef.current = window.setTimeout(() => {
        setIsMounted(false);
        closeTimerRef.current = null;
      }, ANIM_MS);
    }
  }, [props.isOpen, isMounted]);

  if (!isMounted) return null;

  const recruitId = props.mode === "edit" ? props.initialRecruit.id : "new";
  const formKey = `${props.mode}:${recruitId}`;

  return (
    <div className={styles.flyoutRoot} aria-hidden={!props.isOpen && phase !== "closing"}>
      <div className={`${styles.backdrop} ${phase === "open" ? styles.backdropOpen : ""}`} role="presentation" onMouseDown={props.onClose} />

      <aside className={`${styles.flyout} ${phase === "open" ? styles.flyoutOpen : ""}`} role="dialog" aria-modal="true">
        <div className={styles.flyoutInner} onMouseDown={(e) => e.stopPropagation()}>
          <RecruitUpsertForm key={formKey} {...props} statusOptions={statusOptions} />
        </div>
      </aside>
    </div>
  );
}
