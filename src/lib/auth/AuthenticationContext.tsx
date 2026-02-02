import { createContext } from "react";
import type { Session } from "@supabase/supabase-js";

export type AuthenticationContextValue = {
  session: Session | null;
  isAuthenticating: boolean;
  signInWithDiscord: () => Promise<void>;
  signOut: () => Promise<void>;
};

export const AuthenticationContext = createContext<AuthenticationContextValue | null>(null);
