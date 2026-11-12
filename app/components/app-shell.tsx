"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { type ReactNode } from "react";
import { getSupabaseBrowserClient } from "../lib/supabase-browser";
import type { Profile } from "../lib/app-data";

type AppShellProps = {
  children: ReactNode;
  profile: Profile;
  active: "dashboard" | "account";
  eyebrow: string;
  title: string;
  description: string;
};

const navigation = [
  { href: "/dashboard", label: "ড্যাশবোর্ড", icon: "⌂", section: "dashboard" },
  { href: "/dashboard#devices", label: "ডিভাইস", icon: "◉", section: "devices" },
  { href: "/dashboard#scenes", label: "সিন", icon: "✳", section: "scenes" },
  { href: "/dashboard#automations", label: "অটোমেশন", icon: "⟳", section: "automations" },
  { href: "/account", label: "অ্যাকাউন্ট", icon: "◌", section: "account" },
] as const;

export function AppShell({ children, profile, active, eyebrow, title, description }: AppShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const displayName = profile.full_name || [profile.first_name, profile.last_name].filter(Boolean).join(" ") || profile.email;
  const initials = displayName.trim().slice(0, 1).toLocaleUpperCase("bn-BD");

  async function signOut() {
    await getSupabaseBrowserClient().auth.signOut();
    router.replace("/sign-in");
    router.refresh();
  }

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <Link className="brand-lockup app-brand" href="/dashboard" aria-label="ISYEN ড্যাশবোর্ড">
          <span className="brand-icon" aria-hidden="true">ই</span><span className="brand-name">ISYEN<span>.</span></span>
        </Link>
        <div className="sidebar-caption">আপনার স্মার্ট হোম</div>
        <nav className="app-navigation" aria-label="অ্যাপ নেভিগেশন">
          {navigation.map((item) => {
            const isActive = item.section === active || (active === "dashboard" && item.section === "dashboard");
            return (
              <Link key={item.section} href={item.href} className={`app-nav-link${isActive ? " is-active" : ""}`} aria-current={isActive ? "page" : undefined}>
                <span className="app-nav-icon" aria-hidden="true">{item.icon}</span><span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="sidebar-spacer" />
        <div className="sidebar-help-card">
          <span className="sidebar-help-mark" aria-hidden="true">i</span>
          <strong>শুরু করতে সাহায্য লাগবে?</strong>
          <span>প্রথম Home যোগ করে আপনার ডিভাইস সাজান।</span>
          {pathname === "/dashboard" && <a href="#home-setup">Home সেটআপ <span aria-hidden="true">→</span></a>}
        </div>
        <Link className="sidebar-user" href="/account">
          <span className="mini-avatar">{initials}</span>
          <span className="sidebar-user-copy"><strong>{displayName}</strong><small>ব্যক্তিগত অ্যাকাউন্ট</small></span>
          <span className="user-chevron" aria-hidden="true">›</span>
        </Link>
      </aside>

      <div className="app-main-column">
        <header className="app-topbar">
          <div className="app-mobile-brand"><Link className="brand-lockup" href="/dashboard"><span className="brand-icon" aria-hidden="true">ই</span><span className="brand-name">ISYEN<span>.</span></span></Link></div>
          <div className="topbar-context"><span className="topbar-dot" /> ISYEN HOME <span className="topbar-separator">/</span> {active === "account" ? "ACCOUNT" : "OVERVIEW"}</div>
          <div className="topbar-actions">
            <span className="connection-pill"><i /> ডেটাবেজ সংযুক্ত</span>
            <Link className="topbar-account" href="/account" aria-label={`অ্যাকাউন্ট: ${displayName}`}><span className="topbar-account-name">{displayName}</span><span className="mini-avatar">{initials}</span></Link>
            <button className="signout-button" type="button" onClick={() => void signOut()}>সাইন আউট <span aria-hidden="true">↗</span></button>
          </div>
        </header>
        <main className="app-content">
          <div className="app-page-heading">
            <div><span className="app-eyebrow">{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>
          </div>
          {children}
          <footer className="app-footer"><span>ISYEN · আপনার ঘরের ছন্দ</span><span>আরাম থেকে নিরাপত্তা—সব আপনার হাতে।</span></footer>
        </main>
      </div>
    </div>
  );
}
