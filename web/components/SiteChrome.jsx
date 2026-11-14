import Link from "next/link";
import styles from "./site-chrome.module.css";

export default function SiteChrome({ children }) {
  return (
    <>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link className={styles.brand} href="/" aria-label="ISYEN Home">
            <span className={styles.brandMark}>ই</span>
            <span className={styles.brandWord}>
              ISYEN <small>SMART HOME</small>
            </span>
          </Link>
          <nav className={styles.nav} aria-label="প্রধান নেভিগেশন">
            <Link href="/">হোম</Link>
            <Link href="/#features">ফিচার</Link>
            <Link href="/#how-it-works">কীভাবে কাজ করে</Link>
          </nav>
          <div className={styles.actions}>
            <Link className={styles.signIn} href="/signin">সাইন ইন</Link>
            <Link className={styles.signUp} href="/signup">সাইন আপ</Link>
            <Link className={styles.dashboard} href="/dashboard">ড্যাশবোর্ড</Link>
          </div>
        </div>
      </header>
      {children}
      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <span>© {new Date().getFullYear()} ISYEN Smart Home</span>
          <nav aria-label="ফুটার নেভিগেশন">
            <Link href="/">হোম</Link>
            <Link href="/#features">ফিচার</Link>
            <Link href="/signin">সাইন ইন</Link>
            <Link href="/signup">সাইন আপ</Link>
            <Link href="/dashboard">ড্যাশবোর্ড</Link>
          </nav>
        </div>
      </footer>
    </>
  );
}
