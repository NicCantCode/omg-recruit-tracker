import { useContext } from "react";
import { AuthenticationContext } from "./AuthenticationContext";
import type { AuthenticationContextValue } from "./AuthenticationContext";

export function useAuthentication(): AuthenticationContextValue {
  const context = useContext(AuthenticationContext);

  if (!context) throw new Error("useAuth must be used within an AuthenticationProvider.");

  return context;
}
