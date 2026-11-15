"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiUrl, SESSION_KEY } from "../services/config";
import { Loading, Toast } from "./UI";
import OverviewSection from "./Overview";
import DevicesSection from "./Devices";
import SensorsSection from "./Sensors";
import AutomationSection from "./Automations";

const SECTIONS = [
  { id: "overview", label: "Control Panel", href: "/dashboard" },
  { id: "device", label: "Devices", href: "/dashboard/device" },
  { id: "sensor", label: "Sensors", href: "/dashboard/sensor" },
  { id: "automation", label: "Automations", href: "/dashboard/automation" },
];

const SECTION_TITLES = {
  overview: "Control Panel",
  device: "Devices",
  sensor: "Sensors",
  automation: "Automations",
};

async function apiRequest(path, options = {}, accessToken) {
  const headers = new Headers(options.headers || {});
  headers.set("Accept", "application/json");
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
  if (options.body !== undefined && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  let response;
  try {
    response = await fetch(apiUrl(path), { ...options, headers });
  } catch (error) {
    throw new Error(error.message || "Could not connect to the server.");
  }

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
      response.status === 401 || response.status === 403
        ? "Your session has expired. Please sign in again."
        : response.status === 404
          ? "The requested resource was not found."
          : `Request failed (${response.status}). Please try again.`;
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }

  return payload;
}

const getDashboard = (request) => request("/api/dashboard");
const getOptions = (request) => request("/api/options");
const getReadings = (request, type) =>
  request(`/api/readings?type=${encodeURIComponent(type)}`);

function normalizeSession(session) {
  if (!session?.access_token || !session?.refresh_token || !session?.user) {
    return null;
  }
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

export default function Dashboard({ section = "overview" }) {
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
              ) {
                throw error;
              }
              const refreshed = await apiRequest("/api/auth/refresh", {
                method: "POST",
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
          notify("Your session has expired. Please sign in again.", true);
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
    if (!session?.refresh_token || !session.expires_at) return undefined;

    let active = true;
    let timer;

    async function refreshSession() {
      try {
        const result = await apiRequest("/api/auth/refresh", {
          method: "POST",
          body: JSON.stringify({ refresh_token: session.refresh_token }),
        });
        const next = normalizeSession(result.session);
        if (!next) throw new Error("Could not refresh your session.");
        if (active) {
          saveSession(next);
          setSession(next);
        }
      } catch (error) {
        if (!active) return;
        if ([400, 401, 403].includes(error.status)) {
          saveSession(null);
          setSession(null);
          notify("Your session has expired. Please sign in again.", true);
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
        await apiRequest(
          "/api/auth/logout",
          { method: "POST" },
          session.access_token,
        );
      }
    } catch (error) {
      notify(error.message || "Sign-out could not be completed.", true);
    } finally {
      saveSession(null);
      setSession(null);
    }
  }

  return (
    <>
      {starting || !session ? (
        <Loading text="Preparing a secure connection…" />
      ) : (
        <DashboardWorkspace
          key={session.user.id}
          user={session.user}
          session={session}
          onLogout={logout}
          notify={notify}
          section={section}
        />
      )}
      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </>
  );
}

function DashboardWorkspace({ user, session, onLogout, notify, section }) {
  const [data, setData] = useState({
    gateways: [],
    nodes: [],
    devices: [],
    sensors: [],
    automations: [],
    readings: {},
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [options, setOptions] = useState(null);
  const request = useCallback(
    (path, requestOptions = {}) =>
      apiRequest(path, requestOptions, session.access_token),
    [session.access_token],
  );

  const refresh = useCallback(
    async ({ showLoading = false } = {}) => {
      if (showLoading) setLoading(true);
      setError("");
      try {
        const result = await getDashboard(request);
        const readings = {};
        (result.readings || []).forEach((reading) => {
          if (reading.sensor_id != null) readings[reading.sensor_id] = reading;
        });
        setData({
          gateways: result.gateways || [],
          nodes: result.nodes || [],
          devices: result.devices || [],
          sensors: result.sensors || [],
          automations: result.automations || [],
          readings,
        });
      } catch (requestError) {
        setError(requestError.message);
      } finally {
        if (showLoading) setLoading(false);
      }
    },
    [request],
  );

  useEffect(() => {
    void refresh({ showLoading: true });
  }, [refresh]);

  useEffect(() => {
    let active = true;
    getOptions(request)
      .then((result) => {
        if (active) setOptions(result);
      })
      .catch((requestError) => {
        if (active) setError(requestError.message);
      });
    return () => {
      active = false;
    };
  }, [request]);

  useEffect(() => {
    const timer = setInterval(() => void refresh(), 15000);
    return () => clearInterval(timer);
  }, [refresh]);

  useEffect(() => {
    if (!options) return undefined;
    const fastTypes = options.digital_sensor_types;
    const hasFast = data.sensors.some((sensor) =>
      fastTypes.includes(sensor.sensor_type),
    );
    const hasSlow = data.sensors.some(
      (sensor) => !fastTypes.includes(sensor.sensor_type),
    );
    if (!hasFast && !hasSlow) return undefined;

    let active = true;
    async function poll(type) {
      try {
        const result = await getReadings(request, type);
        if (!active) return;
        setData((current) => {
          const readings = { ...current.readings };
          (result.readings || []).forEach((reading) => {
            if (reading.sensor_id != null) readings[reading.sensor_id] = reading;
          });
          return { ...current, readings };
        });
      } catch (pollError) {
        console.debug(pollError);
      }
    }

    const fastTimer = hasFast ? setInterval(() => void poll("fast"), 3000) : null;
    const slowTimer = hasSlow ? setInterval(() => void poll("slow"), 20000) : null;
    return () => {
      active = false;
      if (fastTimer) clearInterval(fastTimer);
      if (slowTimer) clearInterval(slowTimer);
    };
  }, [data.sensors, options, request]);

  return (
    <div className="app-shell">
      <main className="workspace" data-section={section}>
        <section className="dashboard-heading" aria-labelledby="dashboard-title">
          <div>
            <p className="eyebrow">ISYEN · HOME CONTROL</p>
            <h1 id="dashboard-title">{SECTION_TITLES[section] || "Dashboard"}</h1>
          </div>
          <div className="profile">
            <div className="avatar">IS</div>
            <div className="profile-meta">
              <b>{user.email}</b>
              <small>Account</small>
            </div>
            <button className="btn btn-quiet" onClick={onLogout}>
              Sign out
            </button>
          </div>
        </section>

        <nav className="dashboard-section-nav" aria-label="Dashboard sections">
          {SECTIONS.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              className={section === item.id ? "active" : undefined}
              aria-current={section === item.id ? "page" : undefined}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {loading || (!options && !error) ? (
          <Loading />
        ) : error ? (
          <div className="error-panel" role="alert">
            <span className="error-mark">!</span>
            <div>
              <h2>Could not load the dashboard</h2>
              <p>{error}</p>
              <button
                className="btn btn-primary"
                onClick={() => refresh({ showLoading: true })}
              >
                Try again
              </button>
            </div>
          </div>
        ) : (
          <>
            {section === "overview" && (
              <>
                <section className="welcome-row dashboard-welcome-card">
                  <div>
                    <p className="eyebrow">Overview</p>
                    <h2>Your home at a glance</h2>
                    <p className="muted">A quick summary of everything connected.</p>
                  </div>
                  <span className="sync-label">
                    <i className="live-dot" /> Live updates
                  </span>
                </section>

                <section className="stats-grid" aria-label="Summary">
                  <Stat icon="⌘" tint="teal" label="Gateways" value={data.gateways.length} />
                  <Stat
                    icon="⌂"
                    tint="violet"
                    label="Approved Sub Nodes"
                    value={data.nodes.filter((node) => node.is_approved).length}
                  />
                  <Stat icon="◈" tint="amber" label="Devices" value={data.devices.length} />
                  <Stat icon="⌁" tint="blue" label="Sensors" value={data.sensors.length} />
                </section>

                <section className="card-grid dashboard-overview-grid" aria-label="Open a dashboard section">
                  <Link className="card dashboard-overview-card" href="/dashboard/device">
                    <span className="eyebrow">GPIO Controls</span>
                    <strong>Devices</strong>
                    <span className="dashboard-overview-count">{data.devices.length}</span>
                    <span className="muted">Control devices and configure their pins.</span>
                  </Link>
                  <Link className="card dashboard-overview-card" href="/dashboard/sensor">
                    <span className="eyebrow">Monitoring</span>
                    <strong>Sensors</strong>
                    <span className="dashboard-overview-count">{data.sensors.length}</span>
                    <span className="muted">View readings and manage sensors.</span>
                  </Link>
                  <Link className="card dashboard-overview-card" href="/dashboard/automation">
                    <span className="eyebrow">Rules &amp; Actions</span>
                    <strong>Automations</strong>
                    <span className="dashboard-overview-count">{data.automations.length}</span>
                    <span className="muted">Connect sensor conditions to device actions.</span>
                  </Link>
                </section>

                <OverviewSection
                  gateways={data.gateways}
                  nodes={data.nodes}
                  devices={data.devices}
                  sensors={data.sensors}
                  request={request}
                  onRefresh={refresh}
                  notify={notify}
                />
              </>
            )}

            {section === "device" && (
              <DevicesSection
                items={data.devices}
                gateways={data.gateways}
                nodes={data.nodes}
                options={options}
                request={request}
                onRefresh={refresh}
                notify={notify}
              />
            )}
            {section === "sensor" && (
              <SensorsSection
                items={data.sensors}
                gateways={data.gateways}
                nodes={data.nodes}
                readings={data.readings}
                options={options}
                request={request}
                onRefresh={refresh}
                notify={notify}
              />
            )}
            {section === "automation" && (
              <AutomationSection
                gateways={data.gateways}
                sensors={data.sensors}
                devices={data.devices}
                automations={data.automations}
                options={options}
                request={request}
                onRefresh={refresh}
                notify={notify}
              />
            )}
          </>
        )}
      </main>
      <style jsx global>{`
        .app-shell { min-height: calc(100vh - 142px); background: #fff !important; background-image: none !important; background-attachment: scroll !important; }
        .app-shell::before { display: none !important; }
      `}</style>
    </div>
  );
}

function Stat({ icon, tint, label, value }) {
  return (
    <article className="stat-card">
      <span className={`stat-icon ${tint}`}>{icon}</span>
      <div>
        <small>{label}</small>
        <strong>{value}</strong>
      </div>
    </article>
  );
}
