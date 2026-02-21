import { useEffect, useMemo, useState } from "react";
import { useProfile } from "../lib/profile/useProfile";
import { useAuthentication } from "../lib/auth/useAuthentication";
import { supabase } from "../lib/supabaseClient";
import type { Profile } from "../lib/profile/profileTypes";
import styles from "./Settings.module.css";
import Dropdown from "../components/Dropdown";

type SettingsTab = "user" | "owner" | "audit";

type OwnerListRow = {
  id: string;
  display_name: string | null;
  user_name: string | null;
  avatar_url: string | null;
  permission: string;
  last_synced_at: string | null;
  created_at: string;
};

type AuditAction = "create" | "update" | "soft_delete" | "restore";

type AuditLogRow = {
  id: string;
  created_at: string;
  actor_id: string | null;
  entity_type: string;
  entity_id: string;
  entity_label: string | null;
  action: AuditAction;
  changes: Record<string, { old: unknown; new: unknown }>;
};

type AuditActorProfile = {
  id: string;
  display_name: string | null;
  user_name: string | null;
  avatar_url: string | null;
  display_name_override: string | null;
  permission: string;
};

const SETTINGS_TAB_STORAGE_KEY = "settings:selectedTab";
const PLACEHOLDER_AVATAR_URL = "/temp_avatar.svg";

function pickActorName(p: AuditActorProfile | undefined, fallback: string): string {
  if (!p) return fallback;
  if (p.display_name_override && p.display_name_override.trim().length > 0) return p.display_name_override;
  if (p.display_name && p.display_name.trim().length > 0) return p.display_name;
  if (p.user_name && p.user_name.trim().length > 0) return p.user_name;
  return fallback;
}

function pickActorAvatar(p: AuditActorProfile | undefined): string {
  if (p?.avatar_url && p.avatar_url.trim().length > 0) return p.avatar_url;
  return `${import.meta.env.BASE_URL}${PLACEHOLDER_AVATAR_URL}`;
}

function toTitleCase(value: string): string {
  return value
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function actionToVerb(action: AuditAction): string {
  switch (action) {
    case "create":
      return "created";
    case "soft_delete":
      return "deleted";
    case "restore":
      return "restored";
    case "update":
      return "updated";
    default:
      return "updated";
  }
}

function fieldLabel(key: string): string {
  switch (key) {
    case "rs_name":
      return "RS Name";
    case "discord_name":
      return "Discord Name";
    case "status":
      return "Status";
    case "birthday":
      return "Birthday";
    case "joined_at":
      return "Joined";
    case "notes":
      return "Notes";
    case "deleted_at":
      return "Deleted At";
    default:
      return key;
  }
}

function formatValue(key: string, value: unknown): string {
  if (value === null || value === undefined) return "—";

  // Strings that might be dates
  if (typeof value === "string") {
    // notes: show empty nicely
    if (key === "notes") {
      const t = value.trim();
      return t.length ? t : "—";
    }

    const parsed = Date.parse(value);
    // treat ISO strings as dates only for these fields
    if (["birthday", "joined_at", "created_at", "updated_at", "deleted_at"].includes(key) && !Number.isNaN(parsed)) {
      return new Date(parsed).toLocaleString();
    }

    // status: title case
    if (key === "status") return toTitleCase(value);

    return value.length ? value : "—";
  }

  // fallback for non-string values
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function buildSummary(row: AuditLogRow): { headline: string; sub?: string } {
  const label = row.entity_label ?? "Recruit";
  const changes = row.changes ?? {};
  const keys = Object.keys(changes);

  if (row.action === "create") return { headline: `recruit`, sub: label };
  if (row.action === "soft_delete") return { headline: `recruit`, sub: label };
  if (row.action === "restore") return { headline: `recruit`, sub: label };

  // update
  if (keys.length === 0) return { headline: `recruit`, sub: label };

  if (keys.length === 1) {
    const k = keys[0]!;
    const oldV = formatValue(k, changes[k]?.old);
    const newV = formatValue(k, changes[k]?.new);

    return {
      headline: `${fieldLabel(k)}`,
      sub: `${label}: ${oldV} → ${newV}`,
    };
  }

  return {
    headline: `${keys.length} fields`,
    sub: label,
  };
}

function formatDate(value: string | null): string {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString();
}

function readStoredTab(): SettingsTab | null {
  const raw = localStorage.getItem(SETTINGS_TAB_STORAGE_KEY);

  if (raw === "user" || raw === "owner" || raw === "audit") return raw;

  return null;
}

function writeStoredTab(tab: SettingsTab): void {
  localStorage.setItem(SETTINGS_TAB_STORAGE_KEY, tab);
}

function isOwner(profile: Profile | null): boolean {
  return profile?.permission === "owner";
}

function canViewAudit(profile: Profile | null): boolean {
  return profile?.permission === "owner" || profile?.permission === "administrator";
}

function isLocked(profile: Profile | null): boolean {
  return profile?.permission === "locked";
}

export default function Settings() {
  const { session } = useAuthentication();
  const { profile, isProfileLoading, refreshProfileFromAuthentication, reloadProfile, getDisplayName, getAvatarUrl } = useProfile();

  const [tab, setTab] = useState<SettingsTab>("user");

  // User Settings State

  const [displayNameOverride, setDisplayNameOverride] = useState<string>("");
  const [isSavingName, setIsSavingName] = useState<boolean>(false);

  const [isRefreshingAvatar, setIsRefreshingAvatar] = useState<boolean>(false);
  const [refreshError, setRefreshError] = useState<string>("");

  // Admin Settings State

  const [adminUsers, setAdminUsers] = useState<OwnerListRow[]>([]);
  const [isAdminLoading, setIsAdminLoading] = useState<boolean>(false);
  const [adminError, setAdminError] = useState<string>("");
  const [pendingPermissionUpdates, setPendingPermissionUpdates] = useState<Record<string, boolean>>({});

  // Audit Log Settings State

  const [auditRows, setAuditRows] = useState<AuditLogRow[]>([]);
  const [auditActorsById, setAuditActorsById] = useState<Record<string, AuditActorProfile>>({});
  const [isAuditLoading, setIsAuditLoading] = useState<boolean>(false);
  const [auditError, setAuditError] = useState<string>("");

  const userId = session?.user?.id ?? "";

  const displayName = useMemo(() => getDisplayName(), [getDisplayName]);
  const avatarUrl = useMemo(() => getAvatarUrl(), [getAvatarUrl]);

  const owner = useMemo(() => isOwner(profile), [profile]);
  const canAudit = useMemo(() => canViewAudit(profile), [profile]);

  const locked = useMemo(() => isLocked(profile), [profile]);

  const loadAuditLog = async (): Promise<void> => {
    setAuditError("");
    setIsAuditLoading(true);

    const { data, error } = await supabase
      .from("audit_log")
      .select("id, created_at, actor_id, entity_type, entity_id, entity_label, action, changes")
      .eq("entity_type", "recruit")
      .order("created_at", { ascending: false })
      .limit(250);

    if (error) {
      setAuditError(error.message);
      setAuditRows([]);
      setAuditActorsById({});
      setIsAuditLoading(false);
      return;
    }

    const rows = ((data as AuditLogRow[]) ?? []).map((r) => ({
      ...r,
      changes: (r.changes ?? {}) as AuditLogRow["changes"],
    }));

    setAuditRows(rows);

    // Fetch actors (pretty names/avatars) via RPC
    const actorIds = Array.from(new Set(rows.map((r) => r.actor_id).filter(Boolean))) as string[];

    if (actorIds.length === 0) {
      setAuditActorsById({});
      setIsAuditLoading(false);
      return;
    }

    const { data: actorData, error: actorError } = await supabase.rpc("list_profiles_for_audit", {
      actor_ids: actorIds,
    });

    if (actorError) {
      // Non-fatal: still show audit, just fallback to short IDs
      setAuditActorsById({});
      setIsAuditLoading(false);
      return;
    }

    const map: Record<string, AuditActorProfile> = {};
    for (const p of (actorData as AuditActorProfile[]) ?? []) {
      map[p.id] = p;
    }
    setAuditActorsById(map);

    setIsAuditLoading(false);
  };

  useEffect(() => {
    if (!canAudit || tab !== "audit") return;
    void loadAuditLog();
  }, [canAudit, tab]);

  useEffect(() => {
    if (isProfileLoading) return;

    // If you can't see admin/audit tabs, force user
    if (!owner && !canAudit) {
      setTab("user");
      return;
    }

    const saved = readStoredTab();

    // Prevent invalid saved tabs based on permissions
    if (saved === "owner" && !owner) {
      setTab("user");
      return;
    }

    if (saved === "audit" && !canAudit) {
      setTab("user");
      return;
    }

    setTab(saved ?? "user");
  }, [owner, canAudit, isProfileLoading]);

  // Persist tab selection
  useEffect(() => {
    // Only persist if user can actually use extra tabs
    if (!owner && !canAudit) return;

    writeStoredTab(tab);
  }, [tab, owner, canAudit]);

  // Kick user out of admin panel if their permissions change for any reason
  useEffect(() => {
    // If on owner tab and you stop being owner, kick out
    if (tab === "owner" && !owner) setTab("user");

    // If on audit tab and you lose audit permission, kick out
    if (tab === "audit" && !canAudit) setTab("user");
  }, [owner, canAudit, tab]);

  // Keep input in sync with profile value
  useEffect(() => {
    if (profile?.display_name_override) {
      setDisplayNameOverride(profile.display_name_override);
      return;
    }

    setDisplayNameOverride("");
  }, [profile?.display_name_override]);

  const nextRefreshAt = profile?.next_manual_refresh_at ?? null;

  const canRefreshNow = useMemo(() => {
    if (!nextRefreshAt) return true;

    const time = new Date(nextRefreshAt).getTime();
    if (Number.isNaN(time)) return true;

    return Date.now() >= time;
  }, [nextRefreshAt]);

  const refreshCooldownLabel = useMemo(() => {
    if (!nextRefreshAt) return "";

    const time = new Date(nextRefreshAt).getTime();
    if (Number.isNaN(time)) return "";

    const milliseconds = time - Date.now();
    if (milliseconds <= 0) return "";

    const totalSeconds = Math.ceil(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    if (minutes <= 0) return `${seconds}`;

    return `${minutes}m ${seconds}s`;
  }, [nextRefreshAt]);

  const handleSaveDisplayName = async (): Promise<void> => {
    if (!userId) return;

    setIsSavingName(true);

    const newValue = displayNameOverride.trim().length > 0 ? displayNameOverride.trim() : null;

    const { error } = await supabase.from("profiles").update({ display_name_override: newValue }).eq("id", userId);

    if (error) {
      console.error("Failed to save display_name_override:", error.message);
      alert(error.message);
      setIsSavingName(false);
      return;
    }

    await reloadProfile();
    setIsSavingName(false);
  };

  const handleRefreshAvatar = async (): Promise<void> => {
    setRefreshError("");
    setIsRefreshingAvatar(true);

    try {
      await refreshProfileFromAuthentication(true);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to refresh avatar.";
      setRefreshError(message);
    } finally {
      setIsRefreshingAvatar(false);
    }
  };

  const loadAdminUsers = async (): Promise<void> => {
    setAdminError("");
    setIsAdminLoading(true);

    const { data, error } = await supabase.rpc("list_profiles_for_owner");

    if (error) {
      console.error("list_profiles_for_owner error:", error.message);
      setAdminError(error.message);
      setIsAdminLoading(false);
      return;
    }

    // Assert desired structure from unknown return from Supabase
    const rows = (data as OwnerListRow[]) ?? [];
    setAdminUsers(rows);
    setIsAdminLoading(false);
  };

  // Load user list when owner switches to admin settings tab
  useEffect(() => {
    if (!owner || tab !== "owner") return;
    void loadAdminUsers();
  }, [owner, tab]);

  const setUserPermission = async (targetUserId: string, newPermission: string): Promise<void> => {
    if (!owner) return;

    setPendingPermissionUpdates((prev) => ({ ...prev, [targetUserId]: true }));
    setAdminError("");

    const { error } = await supabase.rpc("set_user_permission", {
      target_user_id: targetUserId,
      new_permission: newPermission,
    });

    if (error) {
      console.error("set_user_permission error:", error.message);
      setAdminError(error.message);
      setPendingPermissionUpdates((prev) => ({ ...prev, [targetUserId]: false }));
      return;
    }

    // Await refresh of list after changes
    await loadAdminUsers();

    setPendingPermissionUpdates((prev) => ({ ...prev, [targetUserId]: false }));
  };

  if (isProfileLoading) return null;

  // If profile is unavailable for some reason, fail closed and avoid crashing
  if (!profile) {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Settings</h2>
          <p className={styles.muted}>Profile data is unavailable right now.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.headerRow}>
        <div className={styles.pageTitle}>Settings</div>

        {owner || canAudit ? (
          <div className={styles.tabs}>
            <button type="button" className={`${styles.tabButton} ${tab === "user" ? styles.tabActive : ""}`} onClick={() => setTab("user")}>
              User
            </button>

            {canAudit ? (
              <button type="button" className={`${styles.tabButton} ${tab === "audit" ? styles.tabActive : ""}`} onClick={() => setTab("audit")}>
                Audit Log
              </button>
            ) : null}

            {owner ? (
              <button type="button" className={`${styles.tabButton} ${tab === "owner" ? styles.tabActive : ""}`} onClick={() => setTab("owner")}>
                Administration
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      {tab === "audit" && canAudit ? (
        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>Audit Log</h2>
            <button type="button" onClick={() => void loadAuditLog()} disabled={isAuditLoading}>
              Refresh
            </button>
          </div>

          <p className={styles.muted}>
            Tracks recruit changes. Visible to administrators and owners only. Audit log entries auto-delete when they are {`>`} 6 months old.
          </p>

          {auditError ? <div className={styles.errorBanner}>{auditError}</div> : null}

          <div className={styles.auditList}>
            {isAuditLoading ? (
              <div className={styles.muted}>Loading…</div>
            ) : auditRows.length === 0 ? (
              <div className={styles.muted}>No audit entries found.</div>
            ) : (
              auditRows.map((row) => {
                const actorId = row.actor_id ?? "";
                const actor = actorId ? auditActorsById[actorId] : undefined;

                const actorFallback = actorId ? actorId.split("-")[0] : "Unknown";
                const actorName = pickActorName(actor, actorFallback);
                const actorAvatar = pickActorAvatar(actor);

                const verb = actionToVerb(row.action);
                const summary = buildSummary(row);

                const changes = row.changes ?? {};
                const changeKeys = Object.keys(changes);

                return (
                  <div key={row.id} className={styles.auditItem}>
                    <div className={styles.auditTopRow}>
                      <div className={styles.auditActor}>
                        <img src={actorAvatar} alt="" className={styles.auditAvatar} referrerPolicy="no-referrer" />
                        <div className={styles.auditActorText}>
                          <div className={styles.auditActorName}>
                            {actorName}
                            {actorId === userId ? <span className={styles.auditYou}> (you)</span> : null}
                          </div>
                          <div className={styles.auditWhen} title={formatDate(row.created_at)}>
                            {formatDate(row.created_at)}
                          </div>
                        </div>
                      </div>

                      <div className={styles.auditAction}>
                        <span className={styles.auditActionPill}>{toTitleCase(row.action.replace("_", " "))}</span>
                      </div>
                    </div>

                    <div className={styles.auditMessage}>
                      <span className={styles.auditActorInline}>{actorName}</span> {verb}{" "}
                      <span className={styles.auditHeadline}>{summary.headline}</span>
                      {summary.sub ? <span className={styles.auditSub}> — {summary.sub}</span> : null}
                    </div>

                    {row.action === "update" && changeKeys.length > 0 ? (
                      <details className={styles.auditDetails}>
                        <summary className={styles.auditDetailsSummary}>View changes</summary>
                        <div className={styles.auditChanges}>
                          {changeKeys.map((k) => {
                            const oldV = formatValue(k, changes[k]?.old);
                            const newV = formatValue(k, changes[k]?.new);
                            return (
                              <div key={k} className={styles.auditChangeRow}>
                                <div className={styles.auditChangeKey}>{fieldLabel(k)}</div>
                                <div className={styles.auditChangeVal}>
                                  <span className={styles.auditOld}>{oldV}</span>
                                  <span className={styles.auditArrow}>→</span>
                                  <span className={styles.auditNew}>{newV}</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </details>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>
        </section>
      ) : tab === "owner" && owner ? (
        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>User Management</h2>
            <button type="button" onClick={() => void loadAdminUsers()} disabled={isAdminLoading}>
              Refresh List
            </button>
          </div>

          <p className={styles.muted}>
            New users are <strong>locked</strong> by default. Promote them to allow management of recruits.
          </p>

          {adminError ? <div className={styles.errorBanner}>{adminError}</div> : null}

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>User</th>
                  <th>Permission</th>
                  <th>Last synced</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {isAdminLoading ? (
                  <tr>
                    <td colSpan={4} className={styles.muted}>
                      Loading...
                    </td>
                  </tr>
                ) : adminUsers.length === 0 ? (
                  <tr>
                    <td colSpan={4} className={styles.muted}>
                      No users found.
                    </td>
                  </tr>
                ) : (
                  adminUsers.map((user) => {
                    const isTargetOwner = user.permission === "owner";
                    const isBusy = Boolean(pendingPermissionUpdates[user.id]);

                    const isSelf = user.id === userId;
                    const disabledBecauseSelfOwner = isSelf && isTargetOwner;
                    const disabledBecauseOtherOwner = isTargetOwner && !isSelf;

                    const display = user.display_name || user.user_name || user.id;

                    return (
                      <tr key={user.id}>
                        <td>
                          <div className={styles.userCell}>
                            <img src={user.avatar_url || "/temp_avatar.png"} alt="" className={styles.smallAvatar} />
                            <div className={styles.userCellText}>
                              <div className={styles.userCellName} title={display}>
                                {display}
                              </div>
                              <div className={styles.userCellSub}>{user.id === userId ? "You" : user.user_name || user.id}</div>
                            </div>
                          </div>
                        </td>

                        <td>
                          <Dropdown
                            value={user.permission}
                            options={[
                              { value: "locked", label: "Locked" },
                              { value: "manager", label: "Manager" },
                              { value: "administrator", label: "Administrator" },
                              { value: "owner", label: "Owner", disabled: user.permission === "owner" && user.id !== userId },
                            ]}
                            disabled={isBusy || disabledBecauseSelfOwner}
                            onChange={(next) => {
                              if (disabledBecauseOtherOwner || disabledBecauseSelfOwner) return;
                              void setUserPermission(user.id, next);
                            }}
                          />

                          {disabledBecauseOtherOwner ? <div className={styles.mutedShell}>Owners cannot be demoted here.</div> : null}
                          {disabledBecauseSelfOwner ? <div className={styles.mutedShell}>You cannot change your own role here.</div> : null}
                        </td>

                        <td className={styles.mono}>{formatDate(user.last_synced_at)}</td>
                        <td className={styles.mono}>{formatDate(user.created_at)}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className={styles.futureHint}>Future: bulk actions, filtering, and search can be added here later.</div>
        </section>
      ) : (
        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>Your Profile</h2>
            {locked ? <div className={styles.badge}>LOCKED</div> : <div className={styles.badgeOk}>APPROVED</div>}
          </div>

          <div className={styles.profileRow}>
            <img src={avatarUrl} alt="" className={styles.avatarLarge} />
            <div className={styles.profileMeta}>
              <div className={styles.profileName}>{displayName}</div>
              <div className={styles.mutedSmall}>Permission: {profile.permission}</div>
              <div className={styles.mutedSmall}>Last synced: {formatDate(profile.last_synced_at)}</div>
            </div>
          </div>

          <div className={styles.formRow}>
            <label className={styles.label} htmlFor="displayNameOverride">
              Display name override
            </label>
            <input
              id="displayNameOverride"
              className={styles.input}
              value={displayNameOverride}
              onChange={(e) => setDisplayNameOverride(e.target.value)}
              placeholder="Leave blank to use your Discord name"
            />
            <div className={styles.actions}>
              <button type="button" onClick={() => void handleSaveDisplayName()} disabled={isSavingName}>
                {isSavingName ? "Saving..." : "Save"}
              </button>
              <button
                type="button"
                onClick={() => void handleRefreshAvatar()}
                disabled={isRefreshingAvatar || !canRefreshNow}
                title={!canRefreshNow ? `Try again in ${refreshCooldownLabel}` : ""}
              >
                {isRefreshingAvatar ? "Refreshing..." : !canRefreshNow ? `Refresh avatar (${refreshCooldownLabel})` : "Refresh avatar"}
              </button>
            </div>

            {refreshError ? <div className={styles.errorBanner}>{refreshError}</div> : null}

            <div className={styles.muted}>Avatar refresh is rate-limited. If you recently changed your Discord avatar, wait a bit and try again.</div>
          </div>
        </section>
      )}
    </div>
  );
}
