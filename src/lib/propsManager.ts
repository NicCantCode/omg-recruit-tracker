import type { User } from "@supabase/supabase-js";
import type { ReactNode } from "react";

export type HeaderProps = {
  user: User;
  onSignOut: () => Promise<void>;
};

export type ProtectedRouteProps = {
  children: ReactNode;
};

export type AuthenticationProviderProps = {
  children: ReactNode;
};
