import { Navigate } from "react-router-dom";
import { useAuthentication } from "../lib/auth/useAuthentication";
import type { ProtectedRouteProps } from "../lib/propsManager";

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { session, isAuthenticating } = useAuthentication();

  if (isAuthenticating) return null;

  if (!session) return <Navigate to="/login" replace />;

  return <>{children}</>;
}
