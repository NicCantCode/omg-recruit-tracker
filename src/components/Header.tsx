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
        <img src="/omg_icon.png" className={styles.logo} alt="OMGBRBIceCreamTruck Logo" />
        <div className={styles.titleBlock}>
          <div className={styles.title}>Management Toolset</div>
          <div className={styles.subtitle}>Manage your clan</div>
        </div>
      </div>

      <nav className={styles.nav} aria-label="Primary navigation">
        <a className={styles.navLink} href="#" onClick={(e) => e.preventDefault()}>
          Recruits
        </a>
        <a className={styles.navLink} href="#" onClick={(e) => e.preventDefault()}>
          Ranks
        </a>
        <a className={styles.navLink} href="#" onClick={(e) => e.preventDefault()}>
          Settings
        </a>
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
