import { useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import type { AuthenticationProviderProps } from "../propsManager";
import { supabase } from "../supabaseClient";
import { AuthenticationContext } from "./AuthenticationContext";

export default function AuthenticationProvider({ children }: AuthenticationProviderProps) {
  const [session, setSession] = useState<Session | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState<boolean>(true);

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

  const signInWithDiscord = async (): Promise<void> => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "discord",
      options: {
        redirectTo: window.location.origin,
      },
    });

    if (error) alert(error.message);
  };

  const signOut = async (): Promise<void> => {
    const { error } = await supabase.auth.signOut();

    if (error) alert(error.message);
  };

  const value = useMemo(() => {
    return {
      session,
      isAuthenticating,
      signInWithDiscord,
      signOut,
    };
  }, [session, isAuthenticating]);

  return <AuthenticationContext.Provider value={value}>{children}</AuthenticationContext.Provider>;
}
