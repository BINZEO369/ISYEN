"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { AuthShell } from "./auth-shell";
import { getSupabaseBrowserClient } from "../lib/supabase-browser";

export function SignInForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const { data, error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (authError || !data.session) {
        setError("ইমেইল অথবা পাসওয়ার্ড সঠিক নয়। আবার চেষ্টা করুন।");
        return;
      }
      router.replace("/dashboard");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error && caught.message.includes("configuration")
        ? "অ্যাপের Supabase public configuration সেট করা নেই।"
        : "এখন সাইন ইন করা যাচ্ছে না। কিছুক্ষণ পর আবার চেষ্টা করুন।");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell mode="sign-in">
      <div className="auth-card">
        <div className="auth-heading">
          <span className="section-eyebrow">আপনার ঘরে ফিরে আসুন</span>
          <h2>সাইন ইন করুন</h2>
          <p>আপনার ISYEN অ্যাকাউন্টে প্রবেশ করতে তথ্য দিন।</p>
        </div>
        <form className="auth-form" onSubmit={handleSubmit}>
          <label className="form-field">
            <span>ইমেইল ঠিকানা</span>
            <input autoComplete="email" type="email" inputMode="email" placeholder="name@example.com" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </label>
          <label className="form-field">
            <span>পাসওয়ার্ড</span>
            <span className="password-control">
              <input autoComplete="current-password" type={showPassword ? "text" : "password"} placeholder="আপনার পাসওয়ার্ড" value={password} onChange={(event) => setPassword(event.target.value)} required />
              <button className="password-toggle" type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "পাসওয়ার্ড লুকান" : "পাসওয়ার্ড দেখান"}>{showPassword ? "লুকান" : "দেখুন"}</button>
            </span>
          </label>
          {error && <p className="form-alert" role="alert">{error}</p>}
          <button className="primary-button" type="submit" disabled={busy}>{busy ? <><span className="button-spinner" /> যাচাই হচ্ছে…</> : <>সাইন ইন <span aria-hidden="true">→</span></>}</button>
        </form>
        <div className="auth-switch">নতুন ISYEN-এ? <Link href="/register">অ্যাকাউন্ট তৈরি করুন</Link></div>
      </div>
    </AuthShell>
  );
}
