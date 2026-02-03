import { Outlet } from "react-router-dom";
import { useAuthentication } from "../lib/auth/useAuthentication";
import Header from "../components/Header";
import styles from "./DashboardLayout.module.css";

export default function DashboardLayout() {
  const { session, isAuthenticating, signOut } = useAuthentication();

  if (isAuthenticating) return null;

  if (!session) return null;

  return (
    <div className={styles.shell}>
      <Header onSignOut={signOut} />
      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  );
}
