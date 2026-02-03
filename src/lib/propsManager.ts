import type { ReactNode } from "react";

export type HeaderProps = {
  onSignOut: () => Promise<void>;
};

export type ProtectedRouteProps = {
  children: ReactNode;
};

export type AuthenticationProviderProps = {
  children: ReactNode;
};

export type ProfileProviderProps = {
  children: ReactNode;
};
