import { NavLink } from "react-router-dom";
import type { HeaderProps } from "../lib/propsManager";
import { useProfile } from "../lib/profile/useProfile";
import styles from "./Header.module.css";

export default function Header({ onSignOut }: HeaderProps) {
  const { getAvatarUrl, getDisplayName } = useProfile();

  const displayName = getDisplayName();
  const avatarUrl = getAvatarUrl();

  return (
    <header className={styles.header}>
      <div className={styles.left}>
        <img src={`${import.meta.env.BASE_URL}omg_icon.png`} className={styles.logo} alt="OMGBRBIceCreamTruck Logo" />
        <div className={styles.titleBlock}>
          <div className={styles.title}>Management Toolset</div>
          <div className={styles.subtitle}>Manage your clan</div>
        </div>
      </div>

      <nav className={styles.nav} aria-label="Primary navigation">
        <NavLink className={styles.navLink} to="/">
          Dashboard
        </NavLink>
        <NavLink className={styles.navLink} to="/recruits">
          Recruits
        </NavLink>
        <NavLink className={styles.navLink} to="/ranks">
          Ranks
        </NavLink>
        <NavLink className={styles.navLink} to="/settings">
          Settings
        </NavLink>
      </nav>

      <div className={styles.right}>
        <div className={styles.user}>
          <img src={avatarUrl} className={styles.avatar} alt="" />
          <div className={styles.userName} title={displayName}>
            {displayName}
          </div>
        </div>

        <button type="button" className={styles.logoutButton} onClick={() => void onSignOut()}>
          Log out
        </button>
      </div>
    </header>
  );
}
