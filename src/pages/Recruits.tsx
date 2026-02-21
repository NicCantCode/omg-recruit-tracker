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
import RecruitDetailsModal from "../components/recruits/RecruitDetailsModal";

import type { Profile } from "../lib/profile/profileTypes";

type RecruitRow = Recruit & {
  joined_at?: string | null;
};

type SortKey = "rs_name" | "discord_name" | "status" | "birthday" | "joined_at" | "created_by" | "updated_at" | "created_at" | "deleted_at";
type SortDirection = "ascending" | "descending";

const DEFAULT_SORT_KEY: SortKey = "updated_at";
const DEFAULT_SORT_DIRECTION: SortDirection = "descending";

const DEFAULT_PAGE_SIZE = 10;
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;

const PLACEHOLDER_AVATAR_URL = "/temp_avatar.svg";

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function tokenize(query: string): string[] {
  return normalize(query).split(/\s+/g).filter(Boolean);
}

function computeRelevanceScore(recruit: RecruitRow, tokens: string[]): number {
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

function formatJoined(joinedAt: string | null | undefined): string {
  if (!joinedAt) return "—";

  const t = Date.parse(joinedAt);
  if (Number.isNaN(t)) return joinedAt;

  const diffMs = Date.now() - t;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return "—";
  if (diffDays < 7) return `${diffDays}d`;
  const weeks = Math.floor(diffDays / 7);
  if (weeks < 10) return `${weeks}w`;
  const months = Math.floor(diffDays / 30);
  if (months < 12) return `${months}mo`;
  const years = Math.floor(diffDays / 365);
  return `${years}y`;
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

function creatorFallbackLabel(uuid: string): string {
  return uuid.split("-")[0] ?? uuid;
}

function pickCreatorName(profile: Profile | undefined): string {
  if (!profile) return "Unknown";
  if (profile.display_name_override && profile.display_name_override.trim().length > 0) return profile.display_name_override;
  if (profile.display_name && profile.display_name.trim().length > 0) return profile.display_name;
  if (profile.user_name && profile.user_name.trim().length > 0) return profile.user_name;
  return "Unknown";
}

function pickCreatorAvatar(profile: Profile | undefined): string {
  if (profile?.avatar_url && profile.avatar_url.trim().length > 0) return profile.avatar_url;
  return `${import.meta.env.BASE_URL}${PLACEHOLDER_AVATAR_URL}`;
}

export default function Recruits() {
  // Load ALL recruits once, then paginate locally
  const [recruits, setRecruits] = useState<RecruitRow[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string>("");

  // Filters + search
  const [searchText, setSearchText] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [showDeleted, setShowDeleted] = useState<boolean>(false);

  // Sorting
  const [sortKey, setSortKey] = useState<SortKey>(DEFAULT_SORT_KEY);
  const [sortDirection, setSortDirection] = useState<SortDirection>(DEFAULT_SORT_DIRECTION);
  const [userHasChosenSort, setUserHasChosenSort] = useState<boolean>(false);

  // Presentation pagination
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE);
  const [pageIndex, setPageIndex] = useState<number>(0);

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState<boolean>(false);
  const [editingRecruit, setEditingRecruit] = useState<RecruitRow | null>(null);
  const [viewingRecruit, setViewingRecruit] = useState<RecruitRow | null>(null);

  const [profilesById, setProfilesById] = useState<Record<string, Profile>>({});

  // Undo toast state
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
      .select("id, rs_name, discord_name, status, birthday, joined_at, notes, created_by, created_at, updated_at, deleted_at")
      .order("updated_at", { ascending: false });

    if (isCancelled()) return;

    if (error) {
      setErrorMessage(error.message);
      setRecruits([]);
      setProfilesById({});
      setIsLoading(false);
      return;
    }

    const rows = (data ?? []) as Recruit[];
    setRecruits(rows);

    // Fetch creator profiles for created_by
    const creatorIds = Array.from(new Set(rows.map((r) => r.created_by).filter(Boolean)));

    if (creatorIds.length === 0) {
      setProfilesById({});
      setIsLoading(false);
      return;
    }

    const { data: profileRows, error: profileError } = await supabase
      .from("profiles")
      .select(
        "id, permission, display_name, user_name, avatar_url, provider, provider_user_id, display_name_override, last_synced_at, next_manual_refresh_at, created_at, updated_at",
      )
      .in("id", creatorIds);

    if (isCancelled()) return;

    if (profileError) {
      // Non-fatal: recruits still load, creator column just falls back
      setProfilesById({});
      setIsLoading(false);
      return;
    }

    const map: Record<string, Profile> = {};
    for (const p of (profileRows ?? []) as Profile[]) {
      map[p.id] = p;
    }
    setProfilesById(map);

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

  function onClickHeader(nextKey: SortKey): void {
    setUserHasChosenSort(true);

    if (sortKey !== nextKey) {
      setSortKey(nextKey);
      setSortDirection("ascending");
      return;
    }

    setSortDirection((current) => (current === "ascending" ? "descending" : "ascending"));
  }

  function sortIndicator(key: SortKey): string {
    if (sortKey !== key) return "";
    return sortDirection === "ascending" ? " ▲" : " ▼";
  }

  const tokens = useMemo(() => tokenize(searchText), [searchText]);

  // Filter + sort in-memory
  const visibleRecruits = useMemo(() => {
    const filtered = recruits.filter((recruit) => {
      if (!showDeleted && recruit.deleted_at !== null) return false;
      if (statusFilter !== "all") {
        if (statusFilter === "deleted") {
          if (recruit.deleted_at === null) return false;
        } else {
          if (recruit.status !== statusFilter) return false;
        }
      }

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
        case "joined_at":
          if (!a.recruit.joined_at && !b.recruit.joined_at) comparison = 0;
          else if (!a.recruit.joined_at)
            comparison = 1; // guests last
          else if (!b.recruit.joined_at) comparison = -1;
          else comparison = compareDates(a.recruit.joined_at, b.recruit.joined_at);
          break;
        case "created_by":
          comparison = a.recruit.created_by.toLowerCase().localeCompare(b.recruit.created_by.toLowerCase());
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

  // Reset to page 1 when the view changes
  useEffect(() => {
    setPageIndex(0);
  }, [searchText, statusFilter, showDeleted, pageSize]);

  const totalCount = visibleRecruits.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  function clampPageIndex(next: number): number {
    if (next < 0) return 0;
    const max = Math.max(0, totalPages - 1);
    if (next > max) return max;
    return next;
  }

  // Keep pageIndex valid if page count shrinks
  useEffect(() => {
    setPageIndex((p) => clampPageIndex(p));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalPages]);

  const pageSlice = useMemo(() => {
    const start = pageIndex * pageSize;
    return visibleRecruits.slice(start, start + pageSize);
  }, [visibleRecruits, pageIndex, pageSize]);

  const shownCountText = `Showing ${pageSlice.length} of ${totalCount} (Total in DB: ${recruits.length})`;

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
                setPageSize(DEFAULT_PAGE_SIZE);
                setPageIndex(0);
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
            </div>

            <div className={styles.rightControls}>
              <div className={styles.statusWrap}>
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

              <div className={styles.showDeletedWrap}>
                <label className={styles.label}>Show Deleted</label>
                <div className={styles.controlFieldRow}>
                  <Switch checked={showDeleted} onChange={setShowDeleted} ariaLabel="Show Deleted" />
                </div>
              </div>
            </div>
          </div>

          <div className={styles.metaRow}>
            <div className={styles.metaText}>{shownCountText}</div>

            <div className={styles.paginationRight}>
              <div className={styles.pageButtons}>
                <button
                  className={styles.pageButton}
                  type="button"
                  onClick={() => setPageIndex((p) => clampPageIndex(p - 1))}
                  disabled={pageIndex <= 0}
                >
                  ← Prev
                </button>

                <div className={styles.pageInfo}>
                  Page <b>{pageIndex + 1}</b> of <b>{totalPages}</b>
                </div>

                <button
                  className={styles.pageButton}
                  type="button"
                  onClick={() => setPageIndex((p) => clampPageIndex(p + 1))}
                  disabled={pageIndex >= totalPages - 1}
                >
                  Next →
                </button>
              </div>

              <div className={styles.pageSizeGroup}>
                <span className={styles.pageSizeLabel}>Per page</span>

                <div className={styles.segmentedControl}>
                  {PAGE_SIZE_OPTIONS.map((size) => {
                    const isActive = pageSize === size;

                    return (
                      <button
                        key={size}
                        type="button"
                        className={`${styles.segmentedOption} ${isActive ? styles.segmentedOptionActive : ""}`}
                        onClick={() => setPageSize(size)}
                      >
                        {size}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className={styles.tableCard}>
          {pageSlice.length === 0 ? (
            <div className={styles.emptyState}>
              <div className={styles.emptyTitle}>No recruits found</div>
              <div className={styles.emptyText}>Try adjusting your search, filters, or show deleted toggle.</div>
            </div>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead className={styles.thead}>
                  <tr>
                    <th className={`${styles.th} ${styles.nameCol}`} role="button" onClick={() => onClickHeader("rs_name")} title="Sort">
                      RS Name{sortIndicator("rs_name")}
                    </th>

                    <th className={`${styles.th} ${styles.discordCol}`} role="button" onClick={() => onClickHeader("discord_name")} title="Sort">
                      Discord{sortIndicator("discord_name")}
                    </th>

                    <th className={`${styles.th} ${styles.statusCol}`} role="button" onClick={() => onClickHeader("status")} title="Sort">
                      Status{sortIndicator("status")}
                    </th>

                    <th className={`${styles.th} ${styles.joinedCol}`} role="button" onClick={() => onClickHeader("joined_at")} title="Sort">
                      Joined{sortIndicator("joined_at")}
                    </th>

                    <th className={`${styles.th} ${styles.birthdayCol}`} role="button" onClick={() => onClickHeader("birthday")} title="Sort">
                      Birthday{sortIndicator("birthday")}
                    </th>

                    <th className={`${styles.th} ${styles.notesCol}`}>Notes</th>

                    <th className={`${styles.th} ${styles.updatedCol}`} role="button" onClick={() => onClickHeader("updated_at")} title="Sort">
                      Updated{sortIndicator("updated_at")}
                    </th>

                    <th className={`${styles.th} ${styles.byCol}`} role="button" onClick={() => onClickHeader("created_by")} title="Sort">
                      Added By{sortIndicator("created_by")}
                    </th>

                    <th className={styles.thActions}>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {pageSlice.map((r) => {
                    const isDeleted = r.deleted_at !== null;
                    const creatorProfile = profilesById[r.created_by];
                    const creatorName = pickCreatorName(creatorProfile);
                    const creatorAvatar = pickCreatorAvatar(creatorProfile);
                    const creatorFallback = creatorFallbackLabel(r.created_by);

                    return (
                      <tr key={r.id} className={isDeleted ? styles.rowDeleted : styles.row} onClick={() => setViewingRecruit(r)}>
                        <td className={`${styles.td} ${styles.nameCol}`}>
                          <div className={styles.primaryCellNoWrap}>{r.rs_name}</div>
                        </td>

                        <td className={`${styles.td} ${styles.discordCol}`}>
                          <div className={styles.primaryCellNoWrap}>{r.discord_name ?? "—"}</div>
                        </td>

                        <td className={styles.td}>
                          {isDeleted ? (
                            <span className={`${styles.badge} ${styles.badge_deleted}`}>deleted</span>
                          ) : (
                            <span className={`${styles.badge} ${styles[`badge_${statusToClassKey(r.status)}`] ?? ""}`}>{r.status}</span>
                          )}
                        </td>

                        <td className={`${styles.td} ${styles.joinedCol}`}>
                          <div
                            className={styles.primaryCellNoWrap}
                            title={r.joined_at ? new Date(r.joined_at).toLocaleString() : "Not a member yet (guest)"}
                          >
                            {formatJoined(r.joined_at)}
                          </div>
                        </td>

                        <td className={`${styles.td} ${styles.birthdayCol}`}>
                          <div className={styles.primaryCellNoWrap}>{formatBirthday(r.birthday)}</div>
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

                        <td className={`${styles.td} ${styles.byCol}`}>
                          <div className={styles.byCell} title={`${creatorName} (${r.created_by})`}>
                            <img
                              className={styles.byAvatar}
                              src={creatorAvatar}
                              alt=""
                              referrerPolicy="no-referrer"
                              title={creatorName !== "Unknown" ? creatorName : creatorFallback}
                            />
                          </div>
                        </td>

                        <td className={styles.tdActions}>
                          <button
                            className={styles.iconButton}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingRecruit(r);
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
                              onClick={(e) => {
                                e.stopPropagation();
                                void restoreRecruit(r.id);
                              }}
                              title="Undo delete"
                              aria-label="Undo deletion of recruit"
                            >
                              <img src={undoIcon} alt="" className={styles.iconImage} />
                            </button>
                          ) : (
                            <button
                              className={`${styles.iconButton} ${styles.dangerIconButton}`}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                void softDeleteRecruit(r.id);
                              }}
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

        <CreateRecruitModal
          isOpen={isCreateOpen}
          onClose={() => setIsCreateOpen(false)}
          onSaved={({ recruit, message }) => {
            setRecruits((current) => [recruit as RecruitRow, ...current]);
            showSaveToast(message);
            setPageIndex(0);
          }}
        />

        <EditRecruitModal
          isOpen={editingRecruit !== null}
          recruit={editingRecruit}
          onClose={() => setEditingRecruit(null)}
          onSaved={({ recruit, message }) => {
            setRecruits((current) => current.map((r) => (r.id === (recruit as RecruitRow).id ? (recruit as RecruitRow) : r)));
            setEditingRecruit(recruit as RecruitRow);
            showSaveToast(message);
          }}
        />

        <RecruitDetailsModal
          isOpen={viewingRecruit !== null}
          recruit={viewingRecruit}
          creatorProfile={viewingRecruit ? profilesById[viewingRecruit.created_by] : undefined}
          onClose={() => setViewingRecruit(null)}
          onEdit={() => {
            if (!viewingRecruit) return;

            const r = viewingRecruit;

            // 1) Open edit immediately
            setEditingRecruit(r);

            // 2) Close details AFTER the edit modal has had a chance to paint its overlay
            window.requestAnimationFrame(() => {
              window.requestAnimationFrame(() => {
                setViewingRecruit(null);
              });
            });
          }}
        />

        {saveToast.isVisible && (
          <div className={styles.toast}>
            <div className={styles.toastText}>{saveToast.message}</div>
            <button className={styles.toastButton} type="button" onClick={() => setSaveToast({ isVisible: false, message: "" })}>
              Dismiss
            </button>
          </div>
        )}

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
