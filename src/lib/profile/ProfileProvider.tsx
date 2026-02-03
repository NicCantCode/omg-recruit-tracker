import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";
import { useAuthentication } from "../auth/useAuthentication";
import { ProfileContext } from "./ProfileContext";
import type { Profile } from "./profileTypes";
import type { ProfileProviderProps } from "../propsManager";

const PLACEHOLDER_AVATAR_URL = "/temp_avatar.png";

function isPostgrestSingleRowError(code: string | undefined): boolean {
  return code === "PGRST116";
}

export default function ProfileProvider({ children }: ProfileProviderProps) {
  const { session, isAuthenticating } = useAuthentication();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [isProfileLoading, setIsProfileLoading] = useState<boolean>(true);

  const reloadProfile = useCallback(async (): Promise<void> => {
    if (!session) {
      setProfile(null);
      setIsProfileLoading(false);
      return;
    }

    setIsProfileLoading(true);

    const { data, error } = await supabase
      .from("profiles")
      .select(
        "id, permission, display_name, user_name, avatar_url, provider, provider_user_id, display_name_override, last_synced_at, next_manual_refresh_at, created_at, updated_at",
      )
      .single();

    if (error) {
      if (!isPostgrestSingleRowError(error.code)) alert(error.message);
      setProfile(null);
      setIsProfileLoading(false);
      return;
    }

    setProfile(data as Profile);
    setIsProfileLoading(false);
  }, [session]);

  const refreshProfileFromAuthentication = useCallback(
    async (force: boolean): Promise<void> => {
      if (!session) return;

      const { error } = await supabase.rpc("sync_profile_from_auth", { force });

      if (error) {
        alert(error.message);
        throw error;
      }

      await reloadProfile();
    },
    [session, reloadProfile],
  );

  useEffect(() => {
    if (isAuthenticating) return;

    const run = async (): Promise<void> => {
      if (!session) {
        setProfile(null);
        setIsProfileLoading(false);
        return;
      }

      try {
        await refreshProfileFromAuthentication(false);
      } catch {
        await reloadProfile();
      }
    };

    void run();
  }, [session, isAuthenticating, refreshProfileFromAuthentication, reloadProfile]);

  const getDisplayName = useCallback((): string => {
    if (profile?.display_name_override && profile.display_name_override.trim().length > 0) {
      return profile.display_name_override;
    }

    if (profile?.display_name && profile.display_name.trim().length > 0) {
      return profile.display_name;
    }

    const authenticationDisplay = session?.user?.email || session?.user?.id || "Unknown User";

    return authenticationDisplay;
  }, [profile, session]);

  const getAvatarUrl = useCallback((): string => {
    if (profile?.avatar_url && profile.avatar_url.trim().length > 0) {
      return profile.avatar_url;
    }
    return PLACEHOLDER_AVATAR_URL;
  }, [profile]);

  const value = useMemo(() => {
    return { profile, isProfileLoading, refreshProfileFromAuthentication, reloadProfile, getDisplayName, getAvatarUrl };
  }, [profile, isProfileLoading, refreshProfileFromAuthentication, reloadProfile, getDisplayName, getAvatarUrl]);

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}
