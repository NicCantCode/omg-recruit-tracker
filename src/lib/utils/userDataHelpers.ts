import type { User } from "@supabase/supabase-js";

export type UnknownRecord = Record<string, unknown>;

export function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null;
}

export function getString(obj: UnknownRecord, key: string): string | undefined {
  const value = obj[key];
  return typeof value === "string" ? value : undefined;
}

export function getDisplayName(user: User): string {
  const metaUnknown: unknown = user.user_metadata;

  if (isRecord(metaUnknown)) {
    const customClaimsUnknown = metaUnknown["custom_claims"];

    let globalName;

    if (isRecord(customClaimsUnknown)) {
      globalName = getString(customClaimsUnknown, "global_name");
    }

    const fullName = getString(metaUnknown, "full_name");
    const name = getString(metaUnknown, "name");
    const preferredUsername = getString(metaUnknown, "preferred_username");
    const userName = getString(metaUnknown, "user_name");
    const username = getString(metaUnknown, "username");

    return globalName || fullName || name || preferredUsername || userName || username || user.email || user.id;
  }

  return user.email || user.id;
}
