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
      throw new Error("The server returned an invalid response.");
    }
  }
  if (!response.ok) {
    const message =
      response.status === 400
        ? "Please check your email and password."
        : response.status === 429
          ? "Too many attempts. Please wait a moment and try again."
          : `Request failed (${response.status}). Please try again.`;
    throw new Error(message);
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
        setNotice("Account created. Check your email to verify it, then sign in.");
        form.reset();
        return;
      }
      if (!result.session?.access_token)
        throw new Error("The server did not return a valid sign-in session.");
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(result.session));
      router.replace("/dashboard");
    } catch (e) {
      setError(e.message || "Unable to sign in.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth-screen">
      <section className="auth-panel">
        <div className="brand-mark">I</div>
        <p className="eyebrow auth-eyebrow">SMART LIVING · ISYEN</p>
        <h1>
          Your home,
          <br />
          <span>under your control.</span>
        </h1>
        <p className="auth-intro">
          Manage your smart devices and sensors from one place.
        </p>
        <form onSubmit={submit}>
          <label htmlFor="email">Email address</label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            required
          />
          <label htmlFor="password">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete={signup ? "new-password" : "current-password"}
            minLength={6}
            placeholder="At least 6 characters"
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
              ? "Please wait…"
              : signup
                ? "Create account"
                : "Sign in"}
          </button>
        </form>
        <p className="auth-switch">
          {signup ? "Already have an account?" : "New to ISYEN?"}{" "}
          <button
            type="button"
            className="text-button"
            onClick={() => {
              setError("");
              setNotice("");
              router.push(signup ? "/signin" : "/signup");
            }}
          >
            {signup ? "Sign in" : "Sign up"}
          </button>
        </p>
      </section>
      <aside className="auth-art" aria-label="ISYEN Smart Home">
        <div className="art-orbit orbit-one" />
        <div className="art-orbit orbit-two" />
        <div className="art-copy">
          <span className="live-dot" /> Connected, secure, smart
          <h2>
            Technology that feels
            <br />
            at home.
          </h2>
          <p>Your gateway, lighting, and environmental data—all in one dashboard.</p>
        </div>
        <div className="art-foot">
          ISYEN SMART HOME <span>●</span> CONNECTED LIVING
        </div>
      </aside>
    </main>
  );
}
