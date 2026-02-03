import { Navigate } from "react-router-dom";
import type { RequiredApprovedProps } from "../lib/propsManager";
import { useProfile } from "../lib/profile/useProfile";

export default function RequireApproved({ children }: RequiredApprovedProps) {
  const { profile, isProfileLoading } = useProfile();

  if (isProfileLoading) return null;

  if (!profile) return <Navigate to="/locked" replace />;

  if (profile.permission === "locked") return <Navigate to="/locked" replace />;

  return <>{children}</>;
}
