import type { User } from "@supabase/supabase-js";

export type HeaderProps = {
  user: User;
  onSignOut: () => Promise<void>;
};
