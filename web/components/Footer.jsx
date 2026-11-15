import Link from "next/link";
import styles from "./site-chrome.module.css";

export default function Footer() {
  return (
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
  );
}
