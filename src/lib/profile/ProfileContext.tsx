import { createContext } from "react";
import type { Profile } from "./profileTypes";

export type ProfileContextValue = {
  profile: Profile | null;
  isProfileLoading: boolean;
  refreshProfileFromAuthentication: (force: boolean) => Promise<void>;
  reloadProfile: () => Promise<void>;
  getDisplayName: () => string;
  getAvatarUrl: () => string;
};

export const ProfileContext = createContext<ProfileContextValue | null>(null);
