import type { ReactNode } from "react";
import type { DropdownOption } from "../components/Dropdown";

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

export type RequiredApprovedProps = {
  children: ReactNode;
};

export type DropdownProps = {
  value: string;
  options: DropdownOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  ariaLabel?: string;
};
