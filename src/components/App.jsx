"use client";

import { useCallback, useEffect, useState } from "react";
import AuthScreen from "./AuthScreen";
import DashboardShell from "./DashboardShell";
import { Loading, Toast } from "./Feedback";
import { getSupabase } from "../services/config";

function App() {
  const [session, setSession] = useState(null);
  const [supabase, setSupabase] = useState(null);
  const [starting, setStarting] = useState(true);
  const [toast, setToast] = useState(null);
  const notify = useCallback(
    (message, error = false) => setToast({ message, error }),
    [],
  );
  useEffect(() => {
    let live = true;
    let subscription;
    getSupabase()
      .then(async (sb) => {
        if (!live) return;
        setSupabase(sb);
        const {
          data: { session },
          error,
        } = await sb.auth.getSession();
        if (error) throw error;
        if (live) {
          setSession(session);
          setStarting(false);
        }
        const { data } = sb.auth.onAuthStateChange((_event, next) => {
          if (live) setSession(next);
        });
        subscription = data.subscription;
      })
      .catch((e) => {
        if (live) {
          setStarting(false);
          notify(e.message, true);
        }
      });
    return () => {
      live = false;
      subscription?.unsubscribe();
    };
  }, [notify]);
  async function logout() {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch (e) {
      notify(e.message, true);
    }
  }
  return (
    <>
      {starting ? (
        <Loading text="নিরাপদ সংযোগ প্রস্তুত হচ্ছে…" />
      ) : session && supabase ? (
        <DashboardShell
          key={session.user.id}
          user={session.user}
          supabase={supabase}
          onLogout={logout}
          notify={notify}
        />
      ) : (
        <AuthScreen />
      )}
      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </>
  );
}

export default App;
