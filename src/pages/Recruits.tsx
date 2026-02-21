import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import styles from "./Recruits.module.css";

import editIcon from "../assets/edit.svg";
import deleteIcon from "../assets/delete.svg";
import undoIcon from "../assets/undo.svg";

import type { StatusFilter } from "../lib/constants/recruitStatuses";
import { STATUS_FILTER_OPTIONS } from "../lib/constants/recruitStatuses";
import type { DropdownOption } from "../components/Dropdown";
import Dropdown from "../components/Dropdown";
import Switch from "../components/Switch";
import type { Recruit } from "../lib/constants/recruit";

import CreateRecruitModal from "../components/recruits/CreateRecruitModal";
import EditRecruitModal from "../components/recruits/EditRecruitModal";

type SortKey = "rs_name" | "discord_name" | "status" | "birthday" | "updated_at" | "created_at" | "deleted_at";
type SortDirection = "ascending" | "descending";

const DEFAULT_SORT_KEY: SortKey = "updated_at";
const DEFAULT_SORT_DIRECTION: SortDirection = "descending";

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function tokenize(query: string): string[] {
  return normalize(query).split(/\s+/g).filter(Boolean);
}

function computeRelevanceScore(recruit: Recruit, tokens: string[]): number {
  if (tokens.length === 0) return 0;

  const rsName = normalize(recruit.rs_name);
  const discordName = normalize(recruit.discord_name ?? "");
  const notes = normalize(recruit.notes ?? "");

  let score = 0;

  for (const token of tokens) {
    if (rsName.startsWith(token)) score += 60;
    if (discordName.startsWith(token)) score += 40;
    if (notes.startsWith(token)) score += 10;

    if (rsName.includes(token)) score += 30;
    if (discordName.includes(token)) score += 20;
    if (notes.includes(token)) score += 5;
  }

  return score;
}

function compareNullableStrings(a: string | null, b: string | null): number {
  const aa = (a ?? "").toLowerCase();
  const bb = (b ?? "").toLowerCase();
  return aa.localeCompare(bb);
}

function compareDates(a: string, b: string): number {
  const aa = Date.parse(a);
  const bb = Date.parse(b);
  if (Number.isNaN(aa) && Number.isNaN(bb)) return 0;
  if (Number.isNaN(aa)) return -1;
  if (Number.isNaN(bb)) return 1;
  return aa - bb;
}

function formatRelativeTime(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return iso;

  const diffMs = Date.now() - t;
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
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

function statusToClassKey(status: string): string {
  return status.toLowerCase().replace(/\s+/g, "_");
}

export default function Recruits() {
  const [recruits, setRecruits] = useState<Recruit[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string>("");

  const [searchText, setSearchText] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [showDeleted, setShowDeleted] = useState<boolean>(false);

  const [sortKey, setSortKey] = useState<SortKey>(DEFAULT_SORT_KEY);
  const [sortDirection, setSortDirection] = useState<SortDirection>(DEFAULT_SORT_DIRECTION);
  const [userHasChosenSort, setUserHasChosenSort] = useState<boolean>(false);

  const [isCreateOpen, setIsCreateOpen] = useState<boolean>(false);
  const [isEditOpen, setIsEditOpen] = useState<boolean>(false);
  const [editingRecruit, setEditingRecruit] = useState<Recruit | null>(null);

  const [undoState, setUndoState] = useState<{
    isVisible: boolean;
    recruitId: string | null;
    previousDeletedAt: string | null;
    message: string;
  }>({
    isVisible: false,
    recruitId: null,
    previousDeletedAt: null,
    message: "",
  });

  // Saved toast (separate from undo/delete toast)
  const [saveToast, setSaveToast] = useState<{ isVisible: boolean; message: string }>({
    isVisible: false,
    message: "",
  });

  const statusDropdownOptions: DropdownOption[] = useMemo(() => {
    return STATUS_FILTER_OPTIONS.map((opt) => ({
      value: opt,
      label: toTitleCase(opt),
    }));
  }, []);

  const undoTimeoutRef = useRef<number | null>(null);
  const saveToastTimeoutRef = useRef<number | null>(null);

  function showSaveToast(message: string): void {
    setSaveToast({ isVisible: true, message });

    if (saveToastTimeoutRef.current !== null) window.clearTimeout(saveToastTimeoutRef.current);

    saveToastTimeoutRef.current = window.setTimeout(() => {
      setSaveToast({ isVisible: false, message: "" });
      saveToastTimeoutRef.current = null;
    }, 2200);
  }

  async function loadRecruits(isCancelled: () => boolean = () => false): Promise<void> {
    setIsLoading(true);
    setErrorMessage("");

    const { data, error } = await supabase
      .from("recruits")
      .select("id, rs_name, discord_name, status, birthday, notes, created_by, created_at, updated_at, deleted_at")
      .order("updated_at", { ascending: false });

    if (isCancelled()) return;

    if (error) {
      setErrorMessage(error.message);
      setRecruits([]);
      setIsLoading(false);
      return;
    }

    setRecruits((data ?? []) as Recruit[]);
    setIsLoading(false);
  }

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      await loadRecruits(() => cancelled);
    };

    void run();

    return () => {
      cancelled = true;

      if (undoTimeoutRef.current !== null) window.clearTimeout(undoTimeoutRef.current);
      if (saveToastTimeoutRef.current !== null) window.clearTimeout(saveToastTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (isEditOpen) return;

    const t = window.setTimeout(() => setEditingRecruit(null), 200);
    return () => window.clearTimeout(t);
  }, [isEditOpen]);

  function onClickHeader(nextKey: SortKey): void {
    setUserHasChosenSort(true);

    if (sortKey !== nextKey) {
      setSortKey(nextKey);
      setSortDirection("ascending");
      return;
    }

    setSortDirection((current) => (current === "ascending" ? "descending" : "ascending"));
  }

  const tokens = useMemo(() => tokenize(searchText), [searchText]);

  const visibleRecruits = useMemo(() => {
    const filtered = recruits.filter((recruit) => {
      if (!showDeleted && recruit.deleted_at !== null) return false;
      if (statusFilter !== "all" && recruit.status !== statusFilter) return false;

      if (tokens.length === 0) return true;

      const score = computeRelevanceScore(recruit, tokens);
      return score > 0;
    });

    const shouldSortByRelevance = tokens.length > 0 && !userHasChosenSort;

    const decorated = filtered.map((recruit, index) => ({
      recruit,
      index,
      relevance: shouldSortByRelevance ? computeRelevanceScore(recruit, tokens) : 0,
    }));

    decorated.sort((a, b) => {
      if (shouldSortByRelevance && a.relevance !== b.relevance) {
        return b.relevance - a.relevance;
      }

      let comparison = 0;

      switch (sortKey) {
        case "rs_name":
          comparison = a.recruit.rs_name.toLowerCase().localeCompare(b.recruit.rs_name.toLowerCase());
          break;
        case "discord_name":
          comparison = compareNullableStrings(a.recruit.discord_name, b.recruit.discord_name);
          break;
        case "status":
          comparison = a.recruit.status.toLowerCase().localeCompare(b.recruit.status.toLowerCase());
          break;
        case "birthday":
          if (a.recruit.birthday === null && b.recruit.birthday === null) comparison = 0;
          else if (a.recruit.birthday === null) comparison = 1;
          else if (b.recruit.birthday === null) comparison = -1;
          else comparison = compareDates(a.recruit.birthday, b.recruit.birthday);
          break;
        case "updated_at":
          comparison = compareDates(a.recruit.updated_at, b.recruit.updated_at);
          break;
        case "created_at":
          comparison = compareDates(a.recruit.created_at, b.recruit.created_at);
          break;
        case "deleted_at":
          if (a.recruit.deleted_at === null && b.recruit.deleted_at === null) comparison = 0;
          else if (a.recruit.deleted_at === null) comparison = 1;
          else if (b.recruit.deleted_at === null) comparison = -1;
          else comparison = compareDates(a.recruit.deleted_at, b.recruit.deleted_at);
          break;
        default:
          comparison = 0;
      }

      if (sortDirection === "descending") comparison *= -1;

      if (comparison !== 0) return comparison;
      return a.index - b.index;
    });

    return decorated.map((d) => d.recruit);
  }, [recruits, showDeleted, statusFilter, tokens, sortKey, sortDirection, userHasChosenSort]);

  async function softDeleteRecruit(recruitId: string): Promise<void> {
    const nowIso = new Date().toISOString();

    const previous = recruits.find((recruit) => recruit.id === recruitId);
    const previousDeletedAt = previous?.deleted_at ?? null;

    setRecruits((current) => current.map((recruit) => (recruit.id === recruitId ? { ...recruit, deleted_at: nowIso, updated_at: nowIso } : recruit)));

    setUndoState({
      isVisible: true,
      recruitId,
      previousDeletedAt,
      message: "Recruit deleted.",
    });

    if (undoTimeoutRef.current !== null) window.clearTimeout(undoTimeoutRef.current);

    undoTimeoutRef.current = window.setTimeout(() => {
      setUndoState((state) => ({ ...state, isVisible: false }));
      undoTimeoutRef.current = null;
    }, 6000);

    const { error } = await supabase.from("recruits").update({ deleted_at: nowIso, updated_at: nowIso }).eq("id", recruitId);

    if (error) {
      setRecruits((current) => current.map((recruit) => (recruit.id === recruitId ? { ...recruit, deleted_at: previousDeletedAt } : recruit)));
      setUndoState({
        isVisible: true,
        recruitId: null,
        previousDeletedAt: null,
        message: `Delete failed: ${error.message}`,
      });
    }
  }

  async function restoreRecruit(recruitId: string): Promise<void> {
    const nowIso = new Date().toISOString();

    const previous = recruits.find((r) => r.id === recruitId);
    const previousDeletedAt = previous?.deleted_at ?? null;

    setRecruits((current) => current.map((recruit) => (recruit.id === recruitId ? { ...recruit, deleted_at: null, updated_at: nowIso } : recruit)));

    setUndoState((state) => (state.recruitId === recruitId ? { ...state, isVisible: false, recruitId: null } : state));

    if (undoTimeoutRef.current !== null) {
      window.clearTimeout(undoTimeoutRef.current);
      undoTimeoutRef.current = null;
    }

    const { error } = await supabase.from("recruits").update({ deleted_at: null, updated_at: nowIso }).eq("id", recruitId);

    if (error) {
      setRecruits((current) => current.map((recruit) => (recruit.id === recruitId ? { ...recruit, deleted_at: previousDeletedAt } : recruit)));
      setErrorMessage(`Restore failed: ${error.message}`);
    }
  }

  async function undoDelete(): Promise<void> {
    if (!undoState.recruitId) {
      setUndoState((state) => ({ ...state, isVisible: false }));
      return;
    }

    const recruitId = undoState.recruitId;
    const restoreDeletedAt = undoState.previousDeletedAt;
    const nowIso = new Date().toISOString();

    setRecruits((current) =>
      current.map((recruit) => (recruit.id === recruitId ? { ...recruit, deleted_at: restoreDeletedAt, updated_at: nowIso } : recruit)),
    );

    setUndoState((state) => ({ ...state, isVisible: false, recruitId: null }));

    const { error } = await supabase.from("recruits").update({ deleted_at: restoreDeletedAt, updated_at: nowIso }).eq("id", recruitId);

    if (error) {
      setErrorMessage(`Undo failed: ${error.message}`);
      void loadRecruits();
    }
  }

  function sortIndicator(key: SortKey): string {
    if (sortKey !== key) return "";
    return sortDirection === "ascending" ? " ▲" : " ▼";
  }

  const shownCountText = `Showing ${visibleRecruits.length} of ${recruits.length}`;

  if (isLoading) {
    return (
      <div className={styles.page}>
        <div className={styles.container}>
          <h1 className={styles.title}>Recruits</h1>
          <div className={styles.card}>Loading recruits…</div>
        </div>
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className={styles.page}>
        <div className={styles.container}>
          <h1 className={styles.title}>Recruits</h1>
          <div className={styles.errorCard}>
            <div className={styles.errorTitle}>Failed to load recruits:</div>
            <pre className={styles.errorText}>{errorMessage}</pre>
            <button className={styles.button} onClick={() => void loadRecruits()}>
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <div className={styles.headerRow}>
          <h1 className={styles.title}>Recruits</h1>

          <div className={styles.headerActions}>
            <button
              className={styles.ghostButton}
              type="button"
              onClick={() => {
                setSearchText("");
                setStatusFilter("all");
                setShowDeleted(false);
                setSortKey(DEFAULT_SORT_KEY);
                setSortDirection(DEFAULT_SORT_DIRECTION);
                setUserHasChosenSort(false);
              }}
            >
              Reset Defaults
            </button>

            <button className={styles.primaryButton} type="button" onClick={() => setIsCreateOpen(true)}>
              + Add Recruit
            </button>
          </div>
        </div>

        <div className={styles.controlsCard}>
          <div className={styles.controlsRow}>
            <div className={styles.control}>
              <label className={styles.label} htmlFor="search">
                Search
              </label>
              <input
                id="search"
                className={styles.input}
                value={searchText}
                onChange={(e) => {
                  setSearchText(e.target.value);
                  if (e.target.value.trim().length === 0) setUserHasChosenSort(false);
                }}
                placeholder="Search RS name, Discord name, or notes…"
              />
              {tokens.length > 0 && !userHasChosenSort && <div className={styles.hintText}>Sorting by relevance (name → discord → notes).</div>}
            </div>

            <div className={styles.control}>
              <label className={styles.label} htmlFor="status">
                Status Filter
              </label>
              <Dropdown
                value={statusFilter}
                options={statusDropdownOptions}
                ariaLabel="Status filter"
                onChange={(v) => setStatusFilter(v as StatusFilter)}
              />
            </div>

            <div className={styles.controlInline}>
              <Switch checked={showDeleted} onChange={setShowDeleted} label="Show Deleted" />
            </div>
          </div>

          <div className={styles.metaRow}>
            <div className={styles.metaText}>{shownCountText}</div>
          </div>
        </div>

        <div className={styles.tableCard}>
          {visibleRecruits.length === 0 ? (
            <div className={styles.emptyState}>
              <div className={styles.emptyTitle}>No recruits found</div>
              <div className={styles.emptyText}>Try adjusting your search or filters.</div>
            </div>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead className={styles.thead}>
                  <tr>
                    <th className={`${styles.th} ${styles.nameCol}`} role="button" onClick={() => onClickHeader("rs_name")} title="Sort">
                      RS Name{sortIndicator("rs_name")}
                    </th>
                    <th className={styles.th} role="button" onClick={() => onClickHeader("discord_name")} title="Sort">
                      Discord{sortIndicator("discord_name")}
                    </th>
                    <th className={`${styles.th} ${styles.statusCol}`} role="button" onClick={() => onClickHeader("status")} title="Sort">
                      Status{sortIndicator("status")}
                    </th>

                    <th className={`${styles.th} ${styles.birthdayCol}`} role="button" onClick={() => onClickHeader("birthday")} title="Sort">
                      Birthday{sortIndicator("birthday")}
                    </th>

                    <th className={`${styles.th} ${styles.notesCol}`}>Notes</th>

                    <th className={`${styles.th} ${styles.updatedCol}`} role="button" onClick={() => onClickHeader("updated_at")} title="Sort">
                      Updated{sortIndicator("updated_at")}
                    </th>

                    <th className={styles.thActions}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRecruits.map((r) => {
                    const isDeleted = r.deleted_at !== null;

                    return (
                      <tr key={r.id} className={isDeleted ? styles.rowDeleted : styles.row}>
                        <td className={`${styles.td} ${styles.nameCol}`}>
                          <div className={styles.primaryCellNoWrap}>{r.rs_name}</div>
                        </td>

                        <td className={styles.td}>
                          <div className={styles.primaryCell}>{r.discord_name ?? "—"}</div>
                        </td>

                        <td className={styles.td}>
                          {isDeleted ? (
                            <span className={`${styles.badge} ${styles.badge_deleted}`}>deleted</span>
                          ) : (
                            <span className={`${styles.badge} ${styles[`badge_${statusToClassKey(r.status)}`] ?? ""}`}>{r.status}</span>
                          )}
                        </td>

                        <td className={`${styles.td} ${styles.birthdayCol}`}>
                          <div className={styles.primaryCell}>{formatBirthday(r.birthday)}</div>
                        </td>

                        <td className={`${styles.td} ${styles.notesCol}`}>
                          <div className={styles.notesClamp} title={r.notes ?? ""}>
                            {r.notes ?? "—"}
                          </div>
                        </td>

                        <td className={`${styles.td} ${styles.updatedCol}`}>
                          <div className={styles.primaryCellNoWrap} title={new Date(r.updated_at).toLocaleString()}>
                            {formatRelativeTime(r.updated_at)}
                          </div>
                        </td>

                        <td className={styles.tdActions}>
                          <button
                            className={styles.iconButton}
                            type="button"
                            onClick={() => {
                              setEditingRecruit(r);
                              setIsEditOpen(true);
                            }}
                            disabled={isDeleted}
                            title={isDeleted ? "Restore first to edit" : "Edit"}
                            aria-label="Edit recruit"
                          >
                            <img src={editIcon} alt="" className={styles.iconImage} />
                          </button>

                          {isDeleted ? (
                            <button
                              className={`${styles.iconButton} ${styles.safeIconButton}`}
                              type="button"
                              onClick={() => void restoreRecruit(r.id)}
                              title="Undo delete"
                              aria-label="Undo deletion of recruit"
                            >
                              <img src={undoIcon} alt="" className={styles.iconImage} />
                            </button>
                          ) : (
                            <button
                              className={`${styles.iconButton} ${styles.dangerIconButton}`}
                              type="button"
                              onClick={() => void softDeleteRecruit(r.id)}
                              title="Delete"
                              aria-label="Delete recruit"
                            >
                              <img src={deleteIcon} alt="" className={styles.iconImage} />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Create/Edit modals now update state in-place and show a toast */}
        <CreateRecruitModal
          isOpen={isCreateOpen}
          onClose={() => setIsCreateOpen(false)}
          onSaved={({ recruit, message }) => {
            setRecruits((current) => [recruit, ...current]);
            showSaveToast(message);
          }}
        />

        <EditRecruitModal
          isOpen={isEditOpen}
          recruit={editingRecruit}
          onClose={() => setIsEditOpen(false)}
          onSaved={({ recruit, message }) => {
            setRecruits((current) => current.map((r) => (r.id === recruit.id ? recruit : r)));
            setEditingRecruit(recruit);
            showSaveToast(message);
          }}
        />

        {/* Saved toast */}
        {saveToast.isVisible && (
          <div className={styles.toast}>
            <div className={styles.toastText}>{saveToast.message}</div>
            <button className={styles.toastButton} type="button" onClick={() => setSaveToast({ isVisible: false, message: "" })}>
              Dismiss
            </button>
          </div>
        )}

        {/* Undo/Delete toast */}
        {undoState.isVisible && (
          <div className={styles.toast}>
            <div className={styles.toastText}>{undoState.message}</div>
            {undoState.recruitId && (
              <button className={styles.toastButton} type="button" onClick={() => void undoDelete()}>
                Undo
              </button>
            )}
            <button className={styles.toastButton} type="button" onClick={() => setUndoState((s) => ({ ...s, isVisible: false }))}>
              Dismiss
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
