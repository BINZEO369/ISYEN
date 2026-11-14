import { useState } from "react";
import { getSupabase } from "../services/config";

export default function AuthScreen() {
  const [signup, setSignup] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  async function submit(e) {
    e.preventDefault();
    const form = e.currentTarget;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const sb = await getSupabase();
      const email = form.email.value.trim();
      const password = form.password.value;
      const result = signup
        ? await sb.auth.signUp({ email, password })
        : await sb.auth.signInWithPassword({ email, password });
      if (result.error) throw result.error;
      if (signup && !result.data.session) {
        setNotice("অ্যাকাউন্ট তৈরি হয়েছে—ইমেইল যাচাই করে লগ ইন করুন।");
        setSignup(false);
        form.reset();
      }
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
              setSignup(!signup);
              setError("");
              setNotice("");
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
