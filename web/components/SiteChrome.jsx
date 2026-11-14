import Link from "next/link";
import styles from "./site-chrome.module.css";

export default function SiteChrome({ children }) {
  return (
    <>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link className={styles.brand} href="/" aria-label="ISYEN Home">
            <span className={styles.brandMark}>I</span>
            <span className={styles.brandWord}>
              ISYEN <small>SMART HOME</small>
            </span>
          </Link>
          <nav className={styles.nav} aria-label="Main navigation">
            <Link href="/">Home</Link>
            <Link href="/#features">Features</Link>
            <Link href="/#how-it-works">How it works</Link>
          </nav>
          <div className={styles.actions}>
            <Link className={styles.signIn} href="/signin">Sign in</Link>
            <Link className={styles.signUp} href="/signup">Sign up</Link>
            <Link className={styles.dashboard} href="/dashboard">Dashboard</Link>
          </div>
        </div>
      </header>
      {children}
      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <span>© {new Date().getFullYear()} ISYEN Smart Home</span>
          <nav aria-label="Footer navigation">
            <Link href="/">Home</Link>
            <Link href="/#features">Features</Link>
            <Link href="/signin">Sign in</Link>
            <Link href="/signup">Sign up</Link>
            <Link href="/dashboard">Dashboard</Link>
          </nav>
        </div>
      </footer>
    </>
  );
}
