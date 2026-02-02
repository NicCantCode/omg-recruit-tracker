import { Navigate } from "react-router-dom";
import { useAuthentication } from "../lib/auth/useAuthentication";
import styles from "./Login.module.css";

export default function Login() {
  const { session, isAuthenticating, signInWithDiscord } = useAuthentication();

  if (isAuthenticating) return null;

  if (session) return <Navigate to="/" replace />;

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <img src="/omg_icon.png" alt="omgbrbicecreamtruck logo" className={styles.logo} />
        <h1 className={styles.title}>OMGBRBIceCreamTruck</h1>
        <p className={styles.subtitle}>A clan management web application.</p>

        <button type="button" className={styles.button} onClick={() => void signInWithDiscord()}>
          Sign in with Discord
        </button>
      </div>
    </div>
  );
}
