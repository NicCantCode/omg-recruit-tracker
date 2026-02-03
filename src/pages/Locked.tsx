import { Navigate } from "react-router-dom";
import { useProfile } from "../lib/profile/useProfile";
import styles from "./Locked.module.css";

export default function Locked() {
  const { profile, isProfileLoading } = useProfile();

  if (isProfileLoading) return null;

  if (!profile || profile.permission !== "locked") return <Navigate to="/" replace />;

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h2 className={styles.title}>Pending access approval!</h2>
        <p className={styles.text}>
          Your account is currently locked. If this is your first time logging in, please wait for an owner to approve access. If you are seeing this
          page when you shouldn't, contact an owner-level user immediately.
        </p>
        <p className={styles.subtext}>
          You can still visit <strong>Settings</strong> to adjust your preferred display name and refresh your avatar if you changed it on discord.
        </p>
      </div>
    </div>
  );
}
