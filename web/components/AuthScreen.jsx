"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiUrl, SESSION_KEY } from "../services/config";

async function authRequest(path, body) {
  const response = await fetch(apiUrl(path), {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  let payload = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      throw new Error("সার্ভার থেকে সঠিক JSON উত্তর আসেনি।");
    }
  }
  if (!response.ok) {
    throw new Error(payload?.error || `অনুরোধ ব্যর্থ হয়েছে (${response.status})`);
  }
  return payload;
}

export default function AuthScreen({ mode = "signin" }) {
  const router = useRouter();
  const signup = mode === "signup";
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (sessionStorage.getItem(SESSION_KEY)) router.replace("/dashboard");
  }, [router]);

  async function submit(e) {
    e.preventDefault();
    const form = e.currentTarget;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const email = form.email.value.trim();
      const password = form.password.value;
      const result = await authRequest(
        signup ? "/api/auth/register" : "/api/auth/login",
        { email, password },
      );
      if (signup && !result.session?.access_token) {
        setNotice("অ্যাকাউন্ট তৈরি হয়েছে—ইমেইল যাচাই করে লগ ইন করুন।");
        form.reset();
        return;
      }
      if (!result.session?.access_token)
        throw new Error("সার্ভার থেকে লগইন session পাওয়া যায়নি।");
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(result.session));
      router.replace("/dashboard");
    } catch (e) {
      setError(e.message || "লগ ইন করা যায়নি।");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth-screen">
      <section className="auth-panel">
        <div className="brand-mark">ন</div>
        <p className="eyebrow auth-eyebrow">SMART LIVING · ISYEN</p>
        <h1>
          আপনার ঘর,
          <br />
          <span>আপনার নিয়ন্ত্রণে।</span>
        </h1>
        <p className="auth-intro">
          স্মার্ট ডিভাইস ও সেন্সরগুলোকে এক জায়গা থেকে পরিচালনা করুন।
        </p>
        <form onSubmit={submit}>
          <label htmlFor="email">ইমেইল ঠিকানা</label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            required
          />
          <label htmlFor="password">পাসওয়ার্ড</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete={signup ? "new-password" : "current-password"}
            minLength={6}
            placeholder="কমপক্ষে ৬ অক্ষর"
            required
          />
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          {notice && (
            <p className="form-success" role="status">
              {notice}
            </p>
          )}
          <button
            className="btn btn-primary full"
            type="submit"
            disabled={busy}
          >
            {busy
              ? "অপেক্ষা করুন…"
              : signup
                ? "অ্যাকাউন্ট তৈরি করুন"
                : "লগ ইন করুন"}
          </button>
        </form>
        <p className="auth-switch">
          {signup ? "আগে থেকেই অ্যাকাউন্ট আছে?" : "নতুন অ্যাকাউন্ট তৈরি করবেন?"}{" "}
          <button
            type="button"
            className="text-button"
            onClick={() => {
              setError("");
              setNotice("");
              router.push(signup ? "/signin" : "/signup");
            }}
          >
            {signup ? "লগ ইন" : "সাইন আপ"}
          </button>
        </p>
      </section>
      <aside className="auth-art" aria-label="নিবাস স্মার্ট হোম">
        <div className="art-orbit orbit-one" />
        <div className="art-orbit orbit-two" />
        <div className="art-copy">
          <span className="live-dot" /> সংযুক্ত, নিরাপদ, স্মার্ট
          <h2>
            প্রযুক্তি যখন
            <br />
            ঘরের আপনজন।
          </h2>
          <p>আপনার gateway, আলো ও পরিবেশের তথ্য—সহজে, এক ড্যাশবোর্ডে।</p>
        </div>
        <div className="art-foot">
          ISYEN SMART HOME <span>●</span> CONNECTED LIVING
        </div>
      </aside>
    </main>
  );
}
