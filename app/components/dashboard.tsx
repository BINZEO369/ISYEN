"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { AppShell } from "./app-shell";
import { ApiRequestError, createHome, loadProfile, loadResource, type Automation, type Device, type Gateway, type Home, type Profile, type Room, type Scene } from "../lib/app-data";
import { getSupabaseBrowserClient } from "../lib/supabase-browser";

type DashboardData = {
  profile: Profile;
  homes: Home[];
  devices: Device[];
  rooms: Room[];
  gateways: Gateway[];
  scenes: Scene[];
  automations: Automation[];
};

type DraftHome = { name: string; address_line_1: string; city: string; country: string };
const emptyDraft: DraftHome = { name: "", address_line_1: "", city: "", country: "" };

export function Dashboard() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [selectedHomeId, setSelectedHomeId] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retryCount, setRetryCount] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  const [draft, setDraft] = useState<DraftHome>(emptyDraft);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const supabase = getSupabaseBrowserClient();
        const { data: authData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !authData.session) {
          router.replace("/sign-in");
          return;
        }
        const token = authData.session.access_token;
        const profilePromise = loadProfile(token);
        const resourcesPromise = Promise.all([
          loadResource<Home>("homes", token),
          loadResource<Device>("devices", token),
          loadResource<Room>("rooms", token),
          loadResource<Gateway>("gateways", token),
          loadResource<Scene>("scenes", token),
          loadResource<Automation>("automations", token),
        ]);
        const [profile, [homes, devices, rooms, gateways, scenes, automations]] = await Promise.all([profilePromise, resourcesPromise]);
        if (!cancelled) {
          setAccessToken(token);
          setData({ profile, homes, devices, rooms, gateways, scenes, automations });
          setSelectedHomeId((current) => current || homes[0]?.id || "");
        }
      } catch (caught) {
        if (caught instanceof ApiRequestError && caught.status === 401) {
          await getSupabaseBrowserClient().auth.signOut();
          router.replace("/sign-in");
          return;
        }
        if (!cancelled) setError(caught instanceof Error ? caught.message : "ড্যাশবোর্ডের তথ্য লোড করা যায়নি।");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [router, retryCount]);

  const selectedHome = data?.homes.find((home) => home.id === selectedHomeId) ?? data?.homes[0] ?? null;
  const homeDevices = useMemo(() => data?.devices.filter((item) => item.home_id === selectedHome?.id) ?? [], [data?.devices, selectedHome?.id]);
  const homeRooms = useMemo(() => data?.rooms.filter((item) => item.home_id === selectedHome?.id) ?? [], [data?.rooms, selectedHome?.id]);
  const homeGateways = useMemo(() => data?.gateways.filter((item) => item.home_id === selectedHome?.id) ?? [], [data?.gateways, selectedHome?.id]);
  const homeScenes = useMemo(() => data?.scenes.filter((item) => item.home_id === selectedHome?.id) ?? [], [data?.scenes, selectedHome?.id]);
  const homeAutomations = useMemo(() => data?.automations.filter((item) => item.home_id === selectedHome?.id) ?? [], [data?.automations, selectedHome?.id]);

  async function handleCreateHome(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!accessToken || !data) return;
    setCreating(true);
    setCreateError("");
    try {
      const address = Object.fromEntries(Object.entries({
        address_line_1: draft.address_line_1.trim(), city: draft.city.trim(), country: draft.country.trim(),
      }).filter(([, value]) => value));
      const home = await createHome({ name: draft.name.trim(), timezone: data.profile.timezone || "Asia/Dhaka", address }, accessToken);
      setData((current) => current ? { ...current, homes: [home, ...current.homes] } : current);
      setSelectedHomeId(home.id);
      setDraft(emptyDraft);
      setCreateOpen(false);
    } catch (caught) {
      if (caught instanceof ApiRequestError && caught.status === 401) {
        await getSupabaseBrowserClient().auth.signOut();
        router.replace("/sign-in");
        return;
      }
      setCreateError(caught instanceof Error ? caught.message : "Home তৈরি করা যায়নি। আবার চেষ্টা করুন।");
    } finally {
      setCreating(false);
    }
  }

  if (loading) return <main className="dashboard-loading"><span className="button-spinner" /><p>আপনার স্মার্ট হোম লোড হচ্ছে…</p></main>;
  if (!data) return <main className="dashboard-loading"><div className="dashboard-error"><span className="error-mark">!</span><h1>ড্যাশবোর্ড লোড হয়নি</h1><p>{error || "আপনার অ্যাপের তথ্য আনা যায়নি।"}</p><button className="primary-button" onClick={() => { setError(""); setLoading(true); setRetryCount((count) => count + 1); }}>আবার চেষ্টা করুন</button><button className="text-button" onClick={() => void getSupabaseBrowserClient().auth.signOut().then(() => router.replace("/sign-in"))}>সাইন আউট</button></div></main>;

  const profile = data.profile;
  const displayName = profile.full_name || [profile.first_name, profile.last_name].filter(Boolean).join(" ") || profile.email;
  const activeDevices = homeDevices.filter((device) => device.status === "online").length;
  const enabledScenes = homeScenes.filter((scene) => scene.is_enabled).length;
  const enabledAutomations = homeAutomations.filter((automation) => automation.is_enabled).length;
  const gatewayOnline = homeGateways.filter((gateway) => gateway.status === "online").length;

  return (
    <AppShell profile={profile} active="dashboard" eyebrow="SMART HOME CONTROL" title={`স্বাগতম, ${displayName.split(" ")[0]}`} description="আপনার বাড়ি, ডিভাইস ও দৈনন্দিন অটোমেশন—এক নজরে, এক নিয়ন্ত্রণে।">
      <section className="home-toolbar">
        <div className="selected-home-label"><span className="home-label-icon" aria-hidden="true">⌂</span><div><small>নির্বাচিত HOME</small><strong>{selectedHome?.name ?? "এখনও Home যোগ করা হয়নি"}</strong></div></div>
        <div className="home-toolbar-actions">
          {data.homes.length > 0 && <label className="home-select-wrap"><span className="visually-hidden">Home নির্বাচন করুন</span><select value={selectedHome?.id ?? ""} onChange={(event) => setSelectedHomeId(event.target.value)} aria-label="Home নির্বাচন করুন">{data.homes.map((home) => <option key={home.id} value={home.id}>{home.name}</option>)}</select><span aria-hidden="true">⌄</span></label>}
          <button className="outline-action" type="button" onClick={() => { setCreateError(""); setCreateOpen(true); }}>＋ <span>Home যোগ করুন</span></button>
        </div>
      </section>

      <section className="smart-stats-grid" aria-label="স্মার্ট হোমের সারাংশ">
        <StatCard icon="◉" label="মোট ডিভাইস" value={homeDevices.length} foot={homeDevices.length ? `${activeDevices}টি অনলাইন` : "এখনও ডিভাইস নেই"} tone="sage" />
        <StatCard icon="⌂" label="রুম" value={homeRooms.length} foot={homeRooms.length ? "আপনার Home-এ" : "রুম যোগ করুন"} tone="sand" />
        <StatCard icon="✳" label="সিন" value={homeScenes.length} foot={homeScenes.length ? `${enabledScenes}টি সক্রিয়` : "দ্রুত নিয়ন্ত্রণের জন্য"} tone="lilac" />
        <StatCard icon="⟳" label="অটোমেশন" value={homeAutomations.length} foot={homeAutomations.length ? `${enabledAutomations}টি চালু` : "রুটিন তৈরি করুন"} tone="blue" />
      </section>

      {!selectedHome ? (
        <section className="home-setup-panel" id="home-setup">
          <div className="setup-art" aria-hidden="true"><div className="setup-sun" /><div className="setup-house"><span /><i /><b /></div><div className="setup-ground" /></div>
          <div className="setup-copy"><span className="setup-kicker">আপনার ISYEN যাত্রা শুরু হোক</span><h2>আপনার স্মার্ট হোম তৈরি করুন</h2><p>প্রথম Home যোগ করার পর এখানে রুম, ডিভাইস, গেটওয়ে এবং অটোমেশনের লাইভ অবস্থা দেখতে পাবেন।</p><button className="primary-button" type="button" onClick={() => { setCreateError(""); setCreateOpen(true); }}>প্রথম Home তৈরি করুন <span aria-hidden="true">→</span></button></div>
        </section>
      ) : (
        <>
          <section className="home-overview-card">
            <div className="home-overview-copy"><span className="overview-kicker"><i /> {selectedHome.status === "active" ? "HOME ACTIVE" : selectedHome.status.toUpperCase()}</span><h2>{selectedHome.name}</h2><p>{homeAddress(selectedHome) || "আপনার বাড়ির ঠিকানা এখনো যোগ করা হয়নি।"}</p><span className="timezone-pill">◷ {selectedHome.timezone || profile.timezone}</span></div>
            <div className="overview-illustration" aria-hidden="true"><div className="overview-glow" /><div className="overview-window"><i /><i /><i /><i /></div><div className="overview-roof" /><div className="overview-house"><span /><b /><i /></div><div className="overview-plant plant-one"><i /><i /><b /></div><div className="overview-plant plant-two"><i /><i /><b /></div></div>
            <div className="home-live-summary"><span className="live-summary-icon">⌂</span><strong>{homeDevices.length}</strong><small>সংযুক্ত ডিভাইস</small><span className={`gateway-state${gatewayOnline ? " gateway-online" : ""}`}><i /> {gatewayOnline ? `${gatewayOnline} gateway online` : homeGateways.length ? "Gateway offline" : "Gateway যোগ হয়নি"}</span></div>
          </section>

          <section className="dashboard-panel" id="devices">
            <div className="dashboard-panel-heading"><div><span className="panel-eyebrow">CONTROL YOUR HOME</span><h2>ডিভাইস ও রুম</h2></div><span className="panel-count">{homeDevices.length} ডিভাইস · {homeRooms.length} রুম</span></div>
            {homeDevices.length ? <div className="device-grid">{homeDevices.slice(0, 6).map((device) => <article className="device-card" key={device.id}><span className="device-icon" aria-hidden="true">{deviceGlyph(device.name)}</span><span className={`device-status${device.status === "online" ? " device-status-online" : ""}`}><i />{device.status === "online" ? "অনলাইন" : device.status === "offline" ? "অফলাইন" : device.status}</span><h3>{device.name}</h3><p>{homeRooms.find((room) => room.id === device.room_id)?.name ?? "রুম নির্ধারিত নয়"}</p><span className="device-card-footer">{device.status === "online" ? "সংযুক্ত" : "সংযোগের অপেক্ষায়"}<span>›</span></span></article>)}</div> : <EmptyPanel icon="◉" title="এখনও কোনো ডিভাইস সংযুক্ত নেই" description="আপনার gateway যুক্ত হলে ডিভাইসগুলো এখানে দেখা যাবে।" />}
            {homeRooms.length > 0 && <div className="room-strip"><span className="room-strip-title">আপনার রুম</span>{homeRooms.slice(0, 5).map((room) => <span className="room-chip" key={room.id}><i />{room.name}</span>)}</div>}
          </section>

          <div className="dashboard-lower-grid">
            <section className="dashboard-panel" id="scenes">
              <div className="dashboard-panel-heading"><div><span className="panel-eyebrow">ONE-TAP MOMENTS</span><h2>আপনার সিন</h2></div><span className="panel-count">{homeScenes.length}</span></div>
              {homeScenes.length ? <div className="scene-list">{homeScenes.slice(0, 4).map((scene) => <div className="scene-row" key={scene.id}><span className="scene-mark">{scene.icon || "✳"}</span><span className="scene-copy"><strong>{scene.name}</strong><small>{scene.description || "আপনার তৈরি স্মার্ট দৃশ্য"}</small></span><span className={`scene-state${scene.is_enabled ? " scene-state-on" : ""}`}>{scene.is_enabled ? "প্রস্তুত" : "বন্ধ"}</span></div>)}</div> : <EmptyPanel icon="✳" title="সিন দিয়ে শুরু করুন" description="একটি ট্যাপে আপনার পছন্দের ডিভাইস অবস্থা সাজিয়ে রাখুন।" compact />}
            </section>
            <section className="dashboard-panel" id="automations">
              <div className="dashboard-panel-heading"><div><span className="panel-eyebrow">SMART ROUTINES</span><h2>অটোমেশন</h2></div><span className="panel-count">{enabledAutomations} চালু</span></div>
              {homeAutomations.length ? <div className="automation-list">{homeAutomations.slice(0, 4).map((automation) => <div className="automation-row" key={automation.id}><span className="automation-icon">⟳</span><span className="scene-copy"><strong>{automation.name}</strong><small>{automation.description || "আপনার স্মার্ট রুটিন"}</small></span><span className={`automation-toggle${automation.is_enabled ? " is-on" : ""}`} aria-label={automation.is_enabled ? "চালু" : "বন্ধ"}><i /></span></div>)}</div> : <EmptyPanel icon="⟳" title="আপনার রুটিন এখনো নেই" description="দৈনন্দিন কাজ স্বয়ংক্রিয় করতে অটোমেশন তৈরি করুন।" compact />}
            </section>
          </div>
          <section className="dashboard-next-step" id="home-setup"><span className="next-step-icon" aria-hidden="true">✦</span><div><span className="panel-eyebrow">NEXT STEP</span><h2>আপনার Home-কে আরও স্মার্ট করুন</h2><p>রুম তৈরি করুন, gateway যুক্ত করুন, তারপর ডিভাইস ও automation একসাথে সাজান।</p></div><Link href="/account" className="next-step-link">অ্যাকাউন্ট দেখুন <span aria-hidden="true">→</span></Link></section>
        </>
      )}
      <div className="dashboard-bottom-note"><span><i /> আপনার ডেটা ব্যক্তিগতভাবে সুরক্ষিত</span><Link href="/account">অ্যাকাউন্ট তথ্য <span aria-hidden="true">→</span></Link></div>

      {createOpen && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !creating) setCreateOpen(false); }}><section className="home-modal" role="dialog" aria-modal="true" aria-labelledby="home-modal-title"><button className="modal-close" type="button" aria-label="বন্ধ করুন" onClick={() => setCreateOpen(false)} disabled={creating}>×</button><span className="setup-kicker">HOME SETUP · 01</span><h2 id="home-modal-title">নতুন Home যোগ করুন</h2><p>আপনার বাড়ির নাম ও লোকেশন দিন। পরে সেটিংস থেকে পরিবর্তন করা যাবে।</p><form className="home-create-form" onSubmit={handleCreateHome}><label className="form-field"><span>Home-এর নাম <b>*</b></span><input autoFocus required maxLength={120} placeholder="যেমন: আমার বাড়ি" value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} /></label><label className="form-field"><span>ঠিকানা</span><input autoComplete="street-address" maxLength={250} placeholder="রোড / এলাকার নাম" value={draft.address_line_1} onChange={(event) => setDraft((current) => ({ ...current, address_line_1: event.target.value }))} /></label><div className="form-grid"><label className="form-field"><span>শহর</span><input autoComplete="address-level2" maxLength={120} placeholder="ঢাকা" value={draft.city} onChange={(event) => setDraft((current) => ({ ...current, city: event.target.value }))} /></label><label className="form-field"><span>দেশ</span><input autoComplete="country-name" maxLength={120} placeholder="বাংলাদেশ" value={draft.country} onChange={(event) => setDraft((current) => ({ ...current, country: event.target.value }))} /></label></div>{createError && <p className="form-alert" role="alert">{createError}</p>}<div className="home-modal-actions"><button className="outline-action" type="button" onClick={() => setCreateOpen(false)} disabled={creating}>বাতিল</button><button className="primary-button" type="submit" disabled={creating}>{creating ? <><span className="button-spinner" /> তৈরি হচ্ছে…</> : <>Home তৈরি করুন <span aria-hidden="true">→</span></>}</button></div></form></section></div>}
    </AppShell>
  );
}

function StatCard({ icon, label, value, foot, tone }: { icon: string; label: string; value: number; foot: string; tone: string }) {
  return <article className="smart-stat-card"><span className={`stat-icon stat-${tone}`} aria-hidden="true">{icon}</span><span className="stat-label">{label}</span><strong>{value.toLocaleString("bn-BD")}</strong><small>{foot}</small></article>;
}

function EmptyPanel({ icon, title, description, compact = false }: { icon: string; title: string; description: string; compact?: boolean }) {
  return <div className={`dashboard-empty${compact ? " dashboard-empty-compact" : ""}`}><span className="empty-panel-icon" aria-hidden="true">{icon}</span><div><strong>{title}</strong><p>{description}</p></div></div>;
}

function homeAddress(home: Home) {
  const address = home.address ?? {};
  return [address.address_line_1, address.city, address.country].filter((value): value is string => typeof value === "string" && value.trim().length > 0).join(", ");
}

function deviceGlyph(name: string) {
  const normalized = name.toLowerCase();
  if (normalized.includes("light") || normalized.includes("lamp") || normalized.includes("আলো")) return "✳";
  if (normalized.includes("lock") || normalized.includes("door") || normalized.includes("লক")) return "⌑";
  if (normalized.includes("sensor") || normalized.includes("সেন্সর")) return "◉";
  return "⌂";
}
