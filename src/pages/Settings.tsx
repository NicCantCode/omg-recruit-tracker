import { useEffect, useMemo, useState } from "react";
import { useProfile } from "../lib/profile/useProfile";
import { useAuthentication } from "../lib/auth/useAuthentication";
import { supabase } from "../lib/supabaseClient";
import type { Profile } from "../lib/profile/profileTypes";
import styles from "./Settings.module.css";
import Dropdown from "../components/Dropdown";

type SettingsTab = "user" | "owner";

type OwnerListRow = {
  id: string;
  display_name: string | null;
  user_name: string | null;
  avatar_url: string | null;
  permission: string;
  last_synced_at: string | null;
  created_at: string;
};

const SETTINGS_TAB_STORAGE_KEY = "settings:selectedTab";

function formatDate(value: string | null): string {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString();
}

function readStoredTab(): SettingsTab | null {
  const raw = localStorage.getItem(SETTINGS_TAB_STORAGE_KEY);

  if (raw === "user" || raw === "owner") return raw;

  return null;
}

function writeStoredTab(tab: SettingsTab): void {
  localStorage.setItem(SETTINGS_TAB_STORAGE_KEY, tab);
}

function isOwner(profile: Profile | null): boolean {
  return profile?.permission === "owner";
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

  const userId = session?.user?.id ?? "";

  const displayName = useMemo(() => getDisplayName(), [getDisplayName]);
  const avatarUrl = useMemo(() => getAvatarUrl(), [getAvatarUrl]);

  const owner = useMemo(() => isOwner(profile), [profile]);
  const locked = useMemo(() => isLocked(profile), [profile]);

  // Initialize tab from localStorage (Owners only)
  useEffect(() => {
    if (isProfileLoading) return;

    if (!owner) {
      setTab("user");
      return;
    }

    const saved = readStoredTab();
    setTab(saved ?? "user");
  }, [owner, isProfileLoading]);

  // Persist tab selection
  useEffect(() => {
    if (!owner) return;

    writeStoredTab(tab);
  }, [tab, owner]);

  // Kick user out of admin panel if their permissions change for any reason
  useEffect(() => {
    if (!owner) setTab("user");
  }, [owner]);

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

        {owner ? (
          <div className={styles.tabs}>
            <button type="button" className={`${styles.tabButton} ${tab === "user" ? styles.tabActive : ""}`} onClick={() => setTab("user")}>
              User
            </button>
            <button type="button" className={`${styles.tabButton} ${tab === "owner" ? styles.tabActive : ""}`} onClick={() => setTab("owner")}>
              Administration
            </button>
          </div>
        ) : null}
      </div>

      {tab === "owner" && owner ? (
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
