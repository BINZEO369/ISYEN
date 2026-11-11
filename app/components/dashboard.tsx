"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type CSSProperties } from "react";
import { getSupabaseBrowserClient } from "../lib/supabase-browser";

type Profile = {
  id: string; email: string; full_name: string | null; first_name: string | null; last_name: string | null;
  phone_number: string | null; city: string | null; country: string | null; profile_photo: string | null;
  profile_status: string; profile_completion: number; timezone: string; currency: string; language: string;
  date_format: string; time_format: string; temperature_unit: string; theme: string;
  push_notifications: boolean; email_notifications: boolean; sms_notifications: boolean; security_alerts: boolean;
  device_alerts: boolean; automation_alerts: boolean; created_at: string;
};

type ViewState = "loading" | "ready" | "error";

export function Dashboard() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [state, setState] = useState<ViewState>("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function loadProfile() {
      try {
        const supabase = getSupabaseBrowserClient();
        const { data, error } = await supabase.auth.getSession();
        const session = data.session;
        if (error || !session) {
          router.replace("/sign-in");
          return;
        }
        const response = await fetch("/api/profile", {
          headers: { authorization: `Bearer ${session.access_token}` },
          cache: "no-store",
        });
        const result = await response.json() as { data?: Profile[]; error?: { message?: string } };
        if (response.status === 401) {
          await supabase.auth.signOut();
          router.replace("/sign-in");
          return;
        }
        if (!response.ok) throw new Error(result.error?.message ?? "প্রোফাইল লোড করা যায়নি।");
        const ownProfile = result.data?.[0];
        if (!ownProfile) throw new Error("আপনার প্রোফাইল রেকর্ডটি পাওয়া যায়নি।");
        if (!cancelled) {
          setProfile(ownProfile);
          setState("ready");
        }
      } catch (caught) {
        if (!cancelled) {
          setMessage(caught instanceof Error ? caught.message : "ডেটাবেজ থেকে প্রোফাইল আনা যায়নি।");
          setState("error");
        }
      }
    }
    void loadProfile();
    return () => { cancelled = true; };
  }, [router]);

  async function signOut() {
    await getSupabaseBrowserClient().auth.signOut();
    router.replace("/sign-in");
    router.refresh();
  }

  if (state === "loading") {
    return <main className="dashboard-loading"><span className="button-spinner" /><p>আপনার প্রোফাইল লোড হচ্ছে…</p></main>;
  }
  if (state === "error" || !profile) {
    return (
      <main className="dashboard-loading">
        <div className="dashboard-error"><span className="error-mark">!</span><h1>প্রোফাইল লোড হয়নি</h1><p>{message}</p><button className="primary-button" onClick={() => router.refresh()}>আবার চেষ্টা করুন</button><button className="text-button" onClick={() => void signOut()}>সাইন আউট</button></div>
      </main>
    );
  }

  const displayName = profile.full_name || [profile.first_name, profile.last_name].filter(Boolean).join(" ") || profile.email;
  const joined = profile.created_at ? new Date(profile.created_at).toLocaleDateString("bn-BD", { year: "numeric", month: "long", day: "numeric" }) : "—";

  return (
    <main className="dashboard-page">
      <header className="dashboard-header">
        <Link href="/" className="brand-lockup"><span className="brand-icon" aria-hidden="true">ই</span><span className="brand-name">ISYEN<span>.</span></span></Link>
        <div className="dashboard-header-actions"><span className="connection-pill"><i /> ডেটাবেজ সংযুক্ত</span><button className="signout-button" onClick={() => void signOut()}>সাইন আউট <span aria-hidden="true">↗</span></button></div>
      </header>
      <div className="dashboard-main">
        <div className="dashboard-welcome">
          <div><span className="section-eyebrow">ISYEN CONTROL CENTER</span><h1>স্বাগতম, {displayName.split(" ")[0]}</h1><p>আপনার অ্যাকাউন্ট তৈরি হয়েছে এবং প্রোফাইলটি ডেটাবেজ থেকে লোড হয়েছে।</p></div>
          <div className="profile-completion"><div className="completion-ring" style={{ "--completion": `${profile.profile_completion}%` } as CSSProperties}><strong>{profile.profile_completion}%</strong></div><span>প্রোফাইল সম্পূর্ণ</span></div>
        </div>
        <div className="dashboard-grid">
          <section className="dashboard-card profile-card">
            <div className="card-heading"><div><span className="card-kicker">ACCOUNT PROFILE</span><h2>আপনার প্রোফাইল</h2></div><span className="status-chip">{profile.profile_status === "active" ? "সক্রিয়" : "অসম্পূর্ণ"}</span></div>
            <div className="profile-identity">
              {profile.profile_photo ? (
                // Profile URLs are user-supplied; avoiding Next's optimizer avoids a remote-host allowlist.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profile.profile_photo} alt="" className="profile-avatar" />
              ) : <span className="profile-avatar profile-avatar-initials">{displayName.slice(0, 1).toLocaleUpperCase()}</span>}
              <div><strong>{displayName}</strong><span>{profile.email}</span></div>
            </div>
            <dl className="profile-details">
              <div><dt>Profile ID</dt><dd className="mono-value">{profile.id}</dd></div>
              <div><dt>ফোন</dt><dd>{profile.phone_number || "এখনও যোগ করা হয়নি"}</dd></div>
              <div><dt>অবস্থান</dt><dd>{[profile.city, profile.country].filter(Boolean).join(", ") || "এখনও যোগ করা হয়নি"}</dd></div>
              <div><dt>অ্যাকাউন্ট খোলা হয়েছে</dt><dd>{joined}</dd></div>
            </dl>
          </section>
          <section className="dashboard-card preferences-card">
            <div className="card-heading"><div><span className="card-kicker">YOUR PREFERENCES</span><h2>আপনার পছন্দ</h2></div><span className="preference-icon">✳</span></div>
            <div className="preference-list">
              <Preference label="ভাষা" value={profile.language || "bn"} />
              <Preference label="মুদ্রা" value={profile.currency || "BDT"} />
              <Preference label="টাইমজোন" value={profile.timezone || "Asia/Dhaka"} />
              <Preference label="তারিখ" value={profile.date_format || "YYYY-MM-DD"} />
              <Preference label="সময়" value={profile.time_format || "24h"} />
              <Preference label="তাপমাত্রা" value={profile.temperature_unit === "fahrenheit" ? "°F" : "°C"} />
              <Preference label="থিম" value={profile.theme || "system"} />
            </div>
          </section>
        </div>
        <section className="dashboard-card next-step-card">
          <span className="next-step-icon" aria-hidden="true">⌂</span>
          <div><span className="card-kicker">পরবর্তী ধাপ</span><h2>আপনার প্রথম home যোগ করতে প্রস্তুত</h2><p>আপনার profile ID ডেটাবেজে তৈরি হয়েছে। home ও ESP32-S3 gateway যোগ করলে এখানেই device control শুরু হবে।</p></div>
          <span className="coming-soon">পরের ধাপে</span>
        </section>
        <footer className="dashboard-footer"><span>ISYEN · আপনার ঘরের ছন্দ</span><span>Account ID <code>{profile.id.slice(0, 8)}…</code></span></footer>
      </div>
    </main>
  );
}

function Preference({ label, value }: { label: string; value: string }) {
  return <div className="preference-row"><span>{label}</span><strong>{value}</strong></div>;
}
