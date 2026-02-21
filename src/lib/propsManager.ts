import type { ReactNode } from "react";
import type { DropdownOption } from "../components/Dropdown";
import type { Recruit } from "./constants/recruit";

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
  className?: string;
};

export type SwitchProps = {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
  id?: string;
};

export type RecruitUpsertModalProps =
  | {
      mode: "create";
      isOpen: boolean;
      onClose: () => void;
      onSaved: (payload: { recruit: Recruit; message: string }) => void;
      initialRecruit?: never;
    }
  | {
      mode: "edit";
      isOpen: boolean;
      onClose: () => void;
      onSaved: (payload: { recruit: Recruit; message: string }) => void;
      initialRecruit: Recruit;
    };

export type CreateRecruitModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSaved: (payload: { recruit: Recruit; message: string }) => void;
};

export type EditRecruitModalProps = {
  isOpen: boolean;
  recruit: Recruit | null;
  onClose: () => void;
  onSaved: (payload: { recruit: Recruit; message: string }) => void;
};
