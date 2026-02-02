import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error("Missing VITE_SUPABASE_URL pr VITE_SUPABASE_PUBLISHABLE_KEY in .env.local");
}

export const supabase = createClient(supabaseUrl, supabasePublishableKey);
