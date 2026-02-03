export type Profile = {
  id: string;
  permission: string;
  display_name: string | null;
  user_name: string | null;
  avatar_url: string | null;
  provider: string;
  provider_user_id: string | null;
  display_name_override: string | null;
  last_synced_at: string | null;
  next_manual_refresh_at: string | null;
  created_at: string;
  updated_at: string;
};
