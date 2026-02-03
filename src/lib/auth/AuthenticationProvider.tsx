import { useCallback, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import type { AuthenticationProviderProps } from "../propsManager";
import { supabase } from "../supabaseClient";
import { AuthenticationContext } from "./AuthenticationContext";

export default function AuthenticationProvider({ children }: AuthenticationProviderProps) {
  const [session, setSession] = useState<Session | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState<boolean>(true);

  const redirectTo = useMemo(() => {
    return new URL(import.meta.env.BASE_URL, window.location.origin).toString();
  }, []);

  useEffect(() => {
    const loadSession = async (): Promise<void> => {
      const { data, error } = await supabase.auth.getSession();

      if (error) alert(error.message);

      setSession(data.session);
      setIsAuthenticating(false);
    };

    void loadSession();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setIsAuthenticating(false);
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const signInWithDiscord = useCallback(async (): Promise<void> => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "discord",
      options: {
        redirectTo,
      },
    });

    if (error) alert(error.message);
  }, [redirectTo]);

  const signOut = useCallback(async (): Promise<void> => {
    const { error } = await supabase.auth.signOut();

    if (error) alert(error.message);
  }, []);

  const value = useMemo(() => {
    return {
      session,
      isAuthenticating,
      signInWithDiscord,
      signOut,
    };
  }, [session, isAuthenticating, signInWithDiscord, signOut]);

  return <AuthenticationContext.Provider value={value}>{children}</AuthenticationContext.Provider>;
}
