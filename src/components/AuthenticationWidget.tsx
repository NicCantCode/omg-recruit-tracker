import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import type { Session } from "@supabase/supabase-js";
import { getDisplayName } from "../lib/utils/userDataHelpers";

export default function AuthenticationWidget() {
  const [session, setSession] = useState<Session | null>(null);

  const user = session?.user ?? null;

  const displayName = useMemo(() => {
    if (!user) {
      return "";
    }
    return getDisplayName(user);
  }, [user]);

  useEffect(() => {
    const loadSession = async (): Promise<void> => {
      const { data, error } = await supabase.auth.getSession();

      if (error) {
        console.error("getSession error:", error.message);
        return;
      }

      setSession(data.session);
    };

    void loadSession();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
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

    if (error) {
      console.error("Discord sign-in error:", error.message);
      alert(error.message);
    }
  };

  const signOut = async (): Promise<void> => {
    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error("Sign out error:", error.message);
      alert(error.message);
    }
  };

  if (!user) {
    return (
      <button type="button" onClick={signInWithDiscord}>
        Sign in with Discord
      </button>
    );
  }

  return (
    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
      <div>
        Signed in as <strong>{displayName}</strong>
      </div>
      <button type="button" onClick={signOut}>
        Sign out
      </button>
    </div>
  );
}
