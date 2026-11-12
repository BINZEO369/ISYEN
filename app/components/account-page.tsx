"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "./app-shell";
import { BoardStatusPanel } from "./board-status-panel";
import { ApiRequestError, loadProfile, type Profile } from "../lib/app-data";
import { getSupabaseBrowserClient } from "../lib/supabase-browser";

export function AccountPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const supabase = getSupabaseBrowserClient();
        const { data, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !data.session) {
          router.replace("/sign-in");
          return;
        }
        const ownProfile = await loadProfile(data.session.access_token);
        if (!cancelled) setProfile(ownProfile);
      } catch (caught) {
        if (caught instanceof ApiRequestError && caught.status === 401) {
          await getSupabaseBrowserClient().auth.signOut();
          router.replace("/sign-in");
          return;
        }
        if (!cancelled) setError(caught instanceof Error ? caught.message : "অ্যাকাউন্টের তথ্য লোড করা যায়নি।");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [router, retryCount]);

  if (loading) return <main className="dashboard-loading"><span className="button-spinner" /><p>অ্যাকাউন্টের তথ্য লোড হচ্ছে…</p></main>;
  if (!profile) return <main className="dashboard-loading"><div className="dashboard-error"><span className="error-mark">!</span><h1>অ্যাকাউন্ট দেখা যায়নি</h1><p>{error || "আপনার অ্যাকাউন্টের তথ্য পাওয়া যায়নি।"}</p><button className="primary-button" onClick={() => { setError(""); setLoading(true); setRetryCount((count) => count + 1); }}>আবার চেষ্টা করুন</button><button className="text-button" onClick={() => void getSupabaseBrowserClient().auth.signOut().then(() => router.replace("/sign-in"))}>সাইন আউট</button></div></main>;

  const displayName = profile.full_name || [profile.first_name, profile.last_name].filter(Boolean).join(" ") || profile.email;
  const address = [profile.address_line_1, profile.address_line_2, profile.city, profile.state, profile.postal_code, profile.country].filter(Boolean).join(", ");

  return (
    <AppShell profile={profile} active="account" eyebrow="YOUR ACCOUNT" title="আপনার অ্যাকাউন্ট" description="ব্যক্তিগত তথ্য, ঠিকানা এবং অ্যাপের পছন্দ—সব এক জায়গায় গুছিয়ে দেখুন।">
      <section className="account-hero">
        <div className="account-hero-identity">
          {profile.profile_photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="account-avatar" src={profile.profile_photo} alt={`${displayName}-এর প্রোফাইল`} referrerPolicy="no-referrer" />
          ) : <span className="account-avatar account-avatar-fallback">{displayName.slice(0, 1).toLocaleUpperCase("bn-BD")}</span>}
          <div><span className="account-kicker">ISYEN MEMBER</span><h2>{displayName}</h2><p>{profile.email}</p></div>
        </div>
        <div className="account-hero-status"><span className={`account-status-chip ${profile.profile_status === "active" ? "status-active" : "status-pending"}`}>{profile.profile_status === "active" ? "সক্রিয় অ্যাকাউন্ট" : "প্রোফাইল অসম্পূর্ণ"}</span><div className="account-progress-label"><span>প্রোফাইল সম্পূর্ণ</span><strong>{profile.profile_completion}%</strong></div><div className="account-progress-track"><span style={{ width: `${profile.profile_completion}%` }} /></div></div>
      </section>

      <div className="account-section-heading"><div><span className="app-eyebrow">PROFILE DETAILS</span><h2>অ্যাকাউন্ট তথ্য</h2></div><span>আপনার নিজের তথ্য</span></div>
      <div className="account-card-grid">
        <section className="account-detail-card">
          <div className="account-card-title"><span className="account-card-icon">◌</span><div><h3>ব্যক্তিগত পরিচয়</h3><p>আপনার প্রোফাইলের মৌলিক তথ্য</p></div></div>
          <div className="account-fields-grid">
            <InfoField label="সম্পূর্ণ নাম" value={displayName} />
            <InfoField label="ইমেইল" value={profile.email} />
            <InfoField label="প্রথম নাম" value={profile.first_name} />
            <InfoField label="শেষ নাম" value={profile.last_name} />
            <InfoField label="ফোন নম্বর" value={profile.phone_number} />
            <InfoField label="জন্মতারিখ" value={profile.date_of_birth ? formatDate(profile.date_of_birth) : null} />
            <InfoField label="লিঙ্গ" value={profile.gender} />
            <InfoField label="প্রোফাইল ছবি" value={profile.profile_photo ? "ছবি যুক্ত আছে" : null} />
            <InfoField label="নিজের সম্পর্কে" value={profile.bio} wide />
          </div>
        </section>

        <section className="account-detail-card">
          <div className="account-card-title"><span className="account-card-icon">⌖</span><div><h3>ঠিকানা ও অবস্থান</h3><p>আপনার লোকাল সেটআপের তথ্য</p></div></div>
          <div className="account-fields-grid">
            <InfoField label="দেশ" value={profile.country} />
            <InfoField label="বিভাগ / রাজ্য" value={profile.state} />
            <InfoField label="শহর" value={profile.city} />
            <InfoField label="পোস্টাল কোড" value={profile.postal_code} />
            <InfoField label="ঠিকানা লাইন ১" value={profile.address_line_1} wide />
            <InfoField label="ঠিকানা লাইন ২" value={profile.address_line_2} wide />
            <InfoField label="অক্ষাংশ" value={profile.latitude} />
            <InfoField label="দ্রাঘিমাংশ" value={profile.longitude} />
            <InfoField label="সম্পূর্ণ ঠিকানা" value={address || null} wide />
          </div>
        </section>

        <section className="account-detail-card">
          <div className="account-card-title"><span className="account-card-icon">✳</span><div><h3>অ্যাপের পছন্দ</h3><p>আপনার জন্য ISYEN যেভাবে সাজানো</p></div></div>
          <div className="account-preference-grid">
            <PreferenceTile label="ভাষা" value={profile.language} hint="Language" />
            <PreferenceTile label="মুদ্রা" value={profile.currency} hint="Currency" />
            <PreferenceTile label="টাইমজোন" value={profile.timezone} hint="Local time" />
            <PreferenceTile label="তারিখের ধরন" value={profile.date_format} hint="Date format" />
            <PreferenceTile label="সময়ের ধরন" value={profile.time_format === "12h" ? "১২ ঘণ্টা" : "২৪ ঘণ্টা"} hint="Time format" />
            <PreferenceTile label="তাপমাত্রা" value={profile.temperature_unit === "fahrenheit" ? "ফারেনহাইট · °F" : "সেলসিয়াস · °C"} hint="Temperature" />
            <PreferenceTile label="থিম" value={themeLabel(profile.theme)} hint="Appearance" />
          </div>
        </section>

        <section className="account-detail-card">
          <div className="account-card-title"><span className="account-card-icon">◔</span><div><h3>নোটিফিকেশন</h3><p>কোন আপডেটগুলো পেতে চান</p></div></div>
          <div className="account-notification-list">
            <NotificationRow label="Push notification" checked={profile.push_notifications} />
            <NotificationRow label="ইমেইল আপডেট" checked={profile.email_notifications} />
            <NotificationRow label="SMS আপডেট" checked={profile.sms_notifications} />
            <NotificationRow label="নিরাপত্তা সতর্কতা" checked={profile.security_alerts} />
            <NotificationRow label="ডিভাইস সতর্কতা" checked={profile.device_alerts} />
            <NotificationRow label="অটোমেশন সতর্কতা" checked={profile.automation_alerts} />
          </div>
        </section>
      </div>

      <BoardStatusPanel />

      <section className="account-metadata-card">
        <div><span className="account-card-icon">✓</span><div><h3>অ্যাকাউন্ট স্ট্যাটাস</h3><p>আপনার অ্যাকাউন্ট নিরাপদভাবে সংরক্ষিত</p></div></div>
        <div className="account-metadata-values"><InfoField label="Profile ID" value={profile.id} mono /><InfoField label="তৈরির তারিখ" value={formatDate(profile.created_at)} /><InfoField label="সর্বশেষ আপডেট" value={formatDate(profile.updated_at)} /></div>
      </section>
    </AppShell>
  );
}

function InfoField({ label, value, wide = false, mono = false }: { label: string; value: string | number | null | undefined; wide?: boolean; mono?: boolean }) {
  return <div className={`account-field${wide ? " account-field-wide" : ""}`}><span>{label}</span><strong className={mono ? "account-mono" : ""}>{value === null || value === undefined || value === "" ? "এখনও যোগ করা হয়নি" : value}</strong></div>;
}

function PreferenceTile({ label, value, hint }: { label: string; value: string; hint: string }) {
  return <div className="account-preference-tile"><span>{hint}</span><small>{label}</small><strong>{value || "—"}</strong></div>;
}

function NotificationRow({ label, checked }: { label: string; checked: boolean }) {
  return <div className="account-notification-row"><span>{label}</span><span className={`notification-state${checked ? " notification-on" : ""}`}><i />{checked ? "চালু" : "বন্ধ"}</span></div>;
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? value : date.toLocaleDateString("bn-BD", { year: "numeric", month: "long", day: "numeric" });
}

function themeLabel(theme: Profile["theme"]) {
  return theme === "dark" ? "ডার্ক" : theme === "light" ? "লাইট" : "ডিভাইস অনুযায়ী";
}
