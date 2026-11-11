import Link from "next/link";
import type { ReactNode } from "react";

export function AuthShell({ children, mode }: { children: ReactNode; mode: "sign-in" | "register" }) {
  return (
    <main className={`auth-frame ${mode === "register" ? "auth-frame-register" : ""}`}>
      <aside className="auth-brand-panel">
        <Link className="brand-lockup" href="/" aria-label="ISYEN home">
          <span className="brand-icon" aria-hidden="true">
            <svg viewBox="0 0 44 44" role="presentation">
              <path d="M7 20.5 22 8l15 12.5v15H7z" />
              <path d="M17 35.5V24h10v11.5" />
              <path d="M13 17h.01M31 17h.01" />
            </svg>
          </span>
          <span className="brand-name">ISYEN<span>.</span></span>
        </Link>
        <div className="brand-copy">
          <span className="brand-kicker">আপনার ঘরের ছন্দ</span>
          <h1>আরাম, নিরাপত্তা—সবই আপনার নিয়ন্ত্রণে।</h1>
          <p>একটি সহজ, নির্ভরযোগ্য জায়গা থেকে আপনার স্মার্ট হোমকে সাজান ও পরিচালনা করুন।</p>
        </div>
        <div className="home-illustration" aria-hidden="true">
          <div className="illustration-sun" />
          <div className="illustration-window"><span /><span /><span /><span /></div>
          <div className="illustration-shelf" />
          <div className="illustration-plant"><i /><i /><i /><b /></div>
          <div className="illustration-lamp"><span /><b /></div>
          <div className="illustration-sofa"><span /><i /><b /></div>
          <div className="illustration-card"><span className="live-dot" /><span>বাড়ি</span><strong>শান্ত বিকেল</strong><small>আলো · ৪০%</small></div>
        </div>
        <div className="brand-footer"><span className="footer-line" />সংযুক্ত ঘর, সহজ জীবন</div>
      </aside>
      <section className="auth-content">
        <div className="auth-mobile-brand"><span className="brand-icon" aria-hidden="true">ই</span><span className="brand-name">ISYEN<span>.</span></span></div>
        {children}
        <p className="auth-legal">চালিয়ে গেলে আপনি ISYEN-এর সেবা ব্যবহারের শর্তে সম্মতি দিচ্ছেন।</p>
      </section>
    </main>
  );
}
