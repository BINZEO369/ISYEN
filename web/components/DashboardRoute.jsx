"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import DashboardShell from "./DashboardShell";
import { Loading, Toast } from "./Feedback";
import { apiUrl, SESSION_KEY } from "../services/config";

async function apiRequest(path, options = {}) {
  const response = await fetch(apiUrl(path), {
    ...options,
    headers: new Headers(options.headers || {}),
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
    const error = new Error(payload?.error || `অনুরোধ ব্যর্থ হয়েছে (${response.status})`);
    error.status = response.status;
    throw error;
  }
  return payload;
}

function normalizeSession(session) {
  if (!session?.access_token || !session?.refresh_token || !session?.user)
    return null;
  return {
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_at:
      Number(session.expires_at) ||
      Math.floor(Date.now() / 1000) + Number(session.expires_in || 3600),
    user: session.user,
  };
}

function saveSession(session) {
  if (session) sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  else sessionStorage.removeItem(SESSION_KEY);
}

export default function DashboardRoute() {
  const router = useRouter();
  const [session, setSession] = useState(null);
  const [starting, setStarting] = useState(true);
  const [toast, setToast] = useState(null);
  const notify = useCallback(
    (message, error = false) => setToast({ message, error }),
    [],
  );

  useEffect(() => {
    let live = true;
    async function restoreSession() {
      let restored = null;
      let previousSession = null;
      try {
        const saved = sessionStorage.getItem(SESSION_KEY);
        if (saved) {
          previousSession = normalizeSession(JSON.parse(saved));
          if (previousSession) {
            try {
              const current = await apiRequest("/api/auth/session", {
                headers: {
                  Authorization: `Bearer ${previousSession.access_token}`,
                },
              });
              restored = { ...previousSession, user: current.user };
            } catch (error) {
              if (
                ![401, 403].includes(error.status) ||
                !previousSession.refresh_token
              )
                throw error;
              const refreshed = await apiRequest("/api/auth/refresh", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  refresh_token: previousSession.refresh_token,
                }),
              });
              restored = normalizeSession(refreshed.session);
            }
          }
        }
      } catch (error) {
        if ([400, 401, 403].includes(error.status)) {
          sessionStorage.removeItem(SESSION_KEY);
          notify("সেশনটি মেয়াদোত্তীর্ণ। আবার লগ ইন করুন।", true);
        } else if (previousSession) {
          restored = previousSession;
        } else {
          sessionStorage.removeItem(SESSION_KEY);
        }
      } finally {
        if (live) {
          saveSession(restored);
          setSession(restored);
          setStarting(false);
        }
      }
    }
    void restoreSession();
    return () => {
      live = false;
    };
  }, [notify]);

  useEffect(() => {
    if (!session?.refresh_token || !session.expires_at) return;
    let active = true;
    let timer;
    async function refreshSession() {
      try {
        const result = await apiRequest("/api/auth/refresh", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refresh_token: session.refresh_token }),
        });
        const next = normalizeSession(result.session);
        if (!next) throw new Error("Session refresh করা যায়নি।");
        if (active) {
          saveSession(next);
          setSession(next);
        }
      } catch (error) {
        if (!active) return;
        if ([400, 401, 403].includes(error.status)) {
          saveSession(null);
          setSession(null);
          notify("সেশনটি শেষ হয়েছে। আবার লগ ইন করুন।", true);
        } else {
          timer = setTimeout(refreshSession, 30000);
        }
      }
    }
    const delay = Math.max(
      1000,
      session.expires_at * 1000 - Date.now() - 60000,
    );
    timer = setTimeout(refreshSession, delay);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [session?.refresh_token, session?.expires_at, notify]);

  useEffect(() => {
    if (!starting && !session) router.replace("/signin");
  }, [session, starting, router]);

  async function logout() {
    try {
      if (session?.access_token) {
        await apiRequest("/api/auth/logout", {
          method: "POST",
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
      }
    } catch (error) {
      notify(error.message || "লগ আউট অনুরোধ সম্পন্ন হয়নি।", true);
    } finally {
      saveSession(null);
      setSession(null);
    }
  }

  return (
    <>
      {starting || !session ? (
        <Loading text="নিরাপদ সংযোগ প্রস্তুত হচ্ছে…" />
      ) : (
        <DashboardShell
          key={session.user.id}
          user={session.user}
          session={session}
          onLogout={logout}
          notify={notify}
        />
      )}
      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </>
  );
}
