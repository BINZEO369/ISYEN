"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { AuthShell } from "./auth-shell";
import { getSupabaseBrowserClient } from "../lib/supabase-browser";

type ProfileForm = {
  first_name: string; last_name: string; full_name: string; profile_photo: string; date_of_birth: string; gender: string;
  phone_number: string; bio: string; country: string; state: string; city: string; postal_code: string;
  address_line_1: string; address_line_2: string; latitude: string; longitude: string; language: string; currency: string;
  timezone: string; date_format: string; time_format: "12h" | "24h"; temperature_unit: "celsius" | "fahrenheit";
  theme: "light" | "dark" | "system";
  push_notifications: boolean; email_notifications: boolean; sms_notifications: boolean; security_alerts: boolean;
  device_alerts: boolean; automation_alerts: boolean;
};

const initialProfile: ProfileForm = {
  first_name: "", last_name: "", full_name: "", profile_photo: "", date_of_birth: "", gender: "", phone_number: "", bio: "",
  country: "", state: "", city: "", postal_code: "", address_line_1: "", address_line_2: "", latitude: "", longitude: "",
  language: "bn", currency: "BDT", timezone: "Asia/Dhaka", date_format: "YYYY-MM-DD", time_format: "24h",
  temperature_unit: "celsius", theme: "system", push_notifications: true,
  email_notifications: true, sms_notifications: false, security_alerts: true, device_alerts: true, automation_alerts: true,
};

const textOrNull = (value: string) => value.trim() ? value.trim() : null;
const numberOrNull = (value: string) => value.trim() ? Number(value) : null;

const errorMessages: Record<string, string> = {
  EMAIL_ALREADY_REGISTERED: "এই ইমেইলে আগে থেকেই একটি অ্যাকাউন্ট আছে। সাইন ইন করুন।",
  INVALID_REGISTRATION: "তথ্যগুলো যাচাই করে আবার চেষ্টা করুন।",
  REGISTRATION_NOT_CONFIGURED: "সার্ভারে registration configuration সম্পূর্ণ হয়নি।",
  PROFILE_CREATE_FAILED: "প্রোফাইল সংরক্ষণ করা যায়নি। কিছুক্ষণ পর আবার চেষ্টা করুন।",
  ACCOUNT_SERVICE_UNAVAILABLE: "অ্যাকাউন্ট সার্ভার সাময়িকভাবে পাওয়া যাচ্ছে না।",
};

export function RegisterForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [profile, setProfile] = useState<ProfileForm>(initialProfile);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [createdId, setCreatedId] = useState("");

  function change<K extends keyof ProfileForm>(key: K, value: ProfileForm[K]) {
    setProfile((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setCreatedId("");
    if (password.length < 8) { setError("পাসওয়ার্ড অন্তত ৮ অক্ষরের হতে হবে।"); return; }
    if (password !== confirmPassword) { setError("দুটি পাসওয়ার্ড মিলছে না।"); return; }
    setBusy(true);

    const payload = {
      email: email.trim(),
      password,
      profile: {
        first_name: profile.first_name.trim(),
        last_name: profile.last_name.trim(),
        full_name: textOrNull(profile.full_name),
        profile_photo: textOrNull(profile.profile_photo),
        date_of_birth: textOrNull(profile.date_of_birth),
        gender: textOrNull(profile.gender),
        phone_number: textOrNull(profile.phone_number),
        bio: textOrNull(profile.bio),
        country: textOrNull(profile.country),
        state: textOrNull(profile.state),
        city: textOrNull(profile.city),
        postal_code: textOrNull(profile.postal_code),
        address_line_1: textOrNull(profile.address_line_1),
        address_line_2: textOrNull(profile.address_line_2),
        latitude: numberOrNull(profile.latitude),
        longitude: numberOrNull(profile.longitude),
        language: profile.language.trim() || "bn",
        currency: profile.currency.trim().toUpperCase() || "BDT",
        timezone: profile.timezone.trim() || "Asia/Dhaka",
        date_format: profile.date_format.trim() || "YYYY-MM-DD",
        time_format: profile.time_format,
        temperature_unit: profile.temperature_unit,
        theme: profile.theme,
        push_notifications: profile.push_notifications,
        email_notifications: profile.email_notifications,
        sms_notifications: profile.sms_notifications,
        security_alerts: profile.security_alerts,
        device_alerts: profile.device_alerts,
        automation_alerts: profile.automation_alerts,
      },
    };

    let createdProfileId = "";
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json() as { data?: { id?: string }; error?: { code?: string; message?: string } };
      if (!response.ok) {
        setError(errorMessages[result.error?.code ?? ""] ?? "অ্যাকাউন্ট তৈরি করা যায়নি। তথ্য দেখে আবার চেষ্টা করুন।");
        return;
      }

      const id = result.data?.id ?? "";
      createdProfileId = id;
      setCreatedId(id);
      const { data: signedIn, error: signInError } = await getSupabaseBrowserClient().auth.signInWithPassword({ email: email.trim(), password });
      if (signInError || !signedIn.session) {
        setError("অ্যাকাউন্ট তৈরি হয়েছে; এখন verification লাগবে না। স্বয়ংক্রিয় sign-in সম্পন্ন হয়নি—একই ইমেইল ও পাসওয়ার্ড দিয়ে sign in করুন।");
        setBusy(false);
        return;
      }
      router.replace("/dashboard");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error && caught.message.includes("configuration")
        ? "অ্যাকাউন্ট তৈরি হয়েছে, তবে sign-in configuration অনুপস্থিত। সাপোর্টে যোগাযোগ করুন।"
        : "সংযোগে সমস্যা হয়েছে। আবার চেষ্টা করুন।");
      if (createdProfileId) setCreatedId(createdProfileId);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell mode="register">
      <div className="auth-card register-card">
        <div className="auth-heading">
          <span className="section-eyebrow">একবার সাজান, প্রতিদিন উপভোগ করুন</span>
          <h2>আপনার অ্যাকাউন্ট তৈরি করুন</h2>
          <p>প্রয়োজনীয় ঘরের তথ্য দিন। পরে প্রোফাইল থেকে পরিবর্তন করা যাবে।</p>
        </div>
        <form className="auth-form register-form" onSubmit={handleSubmit}>
          <fieldset className="form-section">
            <legend><span className="step-number">01</span> অ্যাকাউন্ট তথ্য</legend>
            <div className="form-grid">
              <label className="form-field form-field-wide"><span>ইমেইল ঠিকানা <b>*</b></span><input autoComplete="email" type="email" inputMode="email" placeholder="name@example.com" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
              <label className="form-field"><span>পাসওয়ার্ড <b>*</b></span><span className="password-control"><input autoComplete="new-password" type={showPassword ? "text" : "password"} placeholder="কমপক্ষে ৮ অক্ষর" minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} required /><button className="password-toggle" type="button" onClick={() => setShowPassword((value) => !value)}>{showPassword ? "লুকান" : "দেখুন"}</button></span></label>
              <label className="form-field"><span>পাসওয়ার্ড নিশ্চিত করুন <b>*</b></span><input autoComplete="new-password" type="password" placeholder="আবার লিখুন" minLength={8} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required /></label>
            </div>
            <p className="field-note">এই MVP-তে email/OTP verification ধাপ নেই।</p>
          </fieldset>

          <fieldset className="form-section">
            <legend><span className="step-number">02</span> ব্যক্তিগত তথ্য</legend>
            <div className="form-grid">
              <label className="form-field"><span>নামের প্রথম অংশ <b>*</b></span><input autoComplete="given-name" value={profile.first_name} onChange={(event) => change("first_name", event.target.value)} maxLength={120} required /></label>
              <label className="form-field"><span>নামের শেষ অংশ <b>*</b></span><input autoComplete="family-name" value={profile.last_name} onChange={(event) => change("last_name", event.target.value)} maxLength={120} required /></label>
              <label className="form-field"><span>সম্পূর্ণ নাম</span><input autoComplete="name" value={profile.full_name} onChange={(event) => change("full_name", event.target.value)} placeholder="ফাঁকা রাখলে প্রথম ও শেষ নাম থেকে হবে" maxLength={500} /></label>
              <label className="form-field"><span>প্রোফাইল ছবির URL</span><input type="url" inputMode="url" placeholder="https://…" value={profile.profile_photo} onChange={(event) => change("profile_photo", event.target.value)} maxLength={4000} /></label>
              <label className="form-field"><span>জন্মতারিখ</span><input type="date" autoComplete="bday" value={profile.date_of_birth} onChange={(event) => change("date_of_birth", event.target.value)} /></label>
              <label className="form-field"><span>লিঙ্গ (ঐচ্ছিক)</span><input value={profile.gender} onChange={(event) => change("gender", event.target.value)} placeholder="যা লিখতে স্বাচ্ছন্দ্যবোধ করেন" maxLength={120} /></label>
              <label className="form-field"><span>ফোন নম্বর</span><input type="tel" autoComplete="tel" inputMode="tel" placeholder="+880…" value={profile.phone_number} onChange={(event) => change("phone_number", event.target.value)} maxLength={120} /></label>
              <label className="form-field form-field-wide"><span>নিজের সম্পর্কে</span><textarea rows={3} value={profile.bio} onChange={(event) => change("bio", event.target.value)} maxLength={4000} placeholder="কিছু কথা লিখুন…" /></label>
            </div>
          </fieldset>

          <fieldset className="form-section">
            <legend><span className="step-number">03</span> ঠিকানা ও অবস্থান</legend>
            <div className="form-grid">
              <label className="form-field"><span>দেশ</span><input autoComplete="country-name" value={profile.country} onChange={(event) => change("country", event.target.value)} maxLength={4000} /></label>
              <label className="form-field"><span>বিভাগ / রাজ্য</span><input autoComplete="address-level1" value={profile.state} onChange={(event) => change("state", event.target.value)} maxLength={4000} /></label>
              <label className="form-field"><span>শহর</span><input autoComplete="address-level2" value={profile.city} onChange={(event) => change("city", event.target.value)} maxLength={4000} /></label>
              <label className="form-field"><span>পোস্টাল কোড</span><input autoComplete="postal-code" value={profile.postal_code} onChange={(event) => change("postal_code", event.target.value)} maxLength={4000} /></label>
              <label className="form-field form-field-wide"><span>ঠিকানা লাইন ১</span><input autoComplete="address-line1" value={profile.address_line_1} onChange={(event) => change("address_line_1", event.target.value)} maxLength={4000} /></label>
              <label className="form-field form-field-wide"><span>ঠিকানা লাইন ২</span><input autoComplete="address-line2" value={profile.address_line_2} onChange={(event) => change("address_line_2", event.target.value)} maxLength={4000} /></label>
              <label className="form-field"><span>Latitude</span><input type="number" step="any" min="-90" max="90" inputMode="decimal" value={profile.latitude} onChange={(event) => change("latitude", event.target.value)} placeholder="-90 থেকে 90" /></label>
              <label className="form-field"><span>Longitude</span><input type="number" step="any" min="-180" max="180" inputMode="decimal" value={profile.longitude} onChange={(event) => change("longitude", event.target.value)} placeholder="-180 থেকে 180" /></label>
            </div>
          </fieldset>

          <fieldset className="form-section">
            <legend><span className="step-number">04</span> অ্যাপ ও ডিভাইস পছন্দ</legend>
            <div className="form-grid">
              <label className="form-field"><span>ভাষা (locale code)</span><input value={profile.language} onChange={(event) => change("language", event.target.value)} maxLength={20} required /></label>
              <label className="form-field"><span>মুদ্রা (ISO code)</span><input value={profile.currency} onChange={(event) => change("currency", event.target.value)} maxLength={8} required /></label>
              <label className="form-field"><span>টাইমজোন</span><input value={profile.timezone} onChange={(event) => change("timezone", event.target.value)} maxLength={100} required /></label>
              <label className="form-field"><span>তারিখের ফরম্যাট</span><input value={profile.date_format} onChange={(event) => change("date_format", event.target.value)} maxLength={40} required /></label>
              <label className="form-field"><span>সময়ের ফরম্যাট</span><select value={profile.time_format} onChange={(event) => change("time_format", event.target.value as ProfileForm["time_format"])}><option value="24h">২৪ ঘণ্টা</option><option value="12h">১২ ঘণ্টা</option></select></label>
              <label className="form-field"><span>তাপমাত্রার একক</span><select value={profile.temperature_unit} onChange={(event) => change("temperature_unit", event.target.value as ProfileForm["temperature_unit"])}><option value="celsius">Celsius (°C)</option><option value="fahrenheit">Fahrenheit (°F)</option></select></label>
              <label className="form-field"><span>থিম</span><select value={profile.theme} onChange={(event) => change("theme", event.target.value as ProfileForm["theme"])}><option value="system">ডিভাইস অনুযায়ী</option><option value="light">Light</option><option value="dark">Dark</option></select></label>
            </div>
          </fieldset>

          <fieldset className="form-section">
            <legend><span className="step-number">05</span> নোটিফিকেশন পছন্দ</legend>
            <div className="toggle-grid">
              <Toggle label="Push notification" checked={profile.push_notifications} onChange={(checked) => change("push_notifications", checked)} />
              <Toggle label="Email notification" checked={profile.email_notifications} onChange={(checked) => change("email_notifications", checked)} />
              <Toggle label="SMS notification" checked={profile.sms_notifications} onChange={(checked) => change("sms_notifications", checked)} />
              <Toggle label="Security alert" checked={profile.security_alerts} onChange={(checked) => change("security_alerts", checked)} />
              <Toggle label="Device alert" checked={profile.device_alerts} onChange={(checked) => change("device_alerts", checked)} />
              <Toggle label="Automation alert" checked={profile.automation_alerts} onChange={(checked) => change("automation_alerts", checked)} />
            </div>
          </fieldset>

          <div className="generated-fields-note">
            <span className="generated-icon" aria-hidden="true">✓</span>
            <span><strong>সিস্টেম নিজে তৈরি করবে:</strong> profile ID, Auth user ID, ISYEN tenant ID, account status, profile completion এবং created/updated timestamps।</span>
          </div>

          {error && <p className="form-alert" role="alert">{error}{createdId && <><br /><small>আপনার profile ID: {createdId}</small></>}</p>}
          <button className="primary-button" type="submit" disabled={busy}>{busy ? <><span className="button-spinner" /> অ্যাকাউন্ট তৈরি হচ্ছে…</> : <>অ্যাকাউন্ট তৈরি করুন <span aria-hidden="true">→</span></>}</button>
        </form>
        <div className="auth-switch">আগে থেকেই ISYEN ব্যবহার করেন? <Link href="/sign-in">সাইন ইন করুন</Link></div>
      </div>
    </AuthShell>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="toggle-row">
      <span>{label}</span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <i aria-hidden="true" />
    </label>
  );
}
