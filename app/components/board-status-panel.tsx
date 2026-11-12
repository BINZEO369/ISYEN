"use client";

import { useEffect, useState } from "react";
import { ApiRequestError, loadGatewayStatus, type Gateway, type GatewayStatus } from "../lib/app-data";
import { getSupabaseBrowserClient } from "../lib/supabase-browser";

const refreshIntervalMs = 8_000;

export function BoardStatusPanel() {
  const [status, setStatus] = useState<GatewayStatus | null>(null);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      try {
        const sessionResult = await getSupabaseBrowserClient().auth.getSession();
        const token = sessionResult.data.session?.access_token;
        if (!token) throw new ApiRequestError("সাইন-ইন সেশন পাওয়া যায়নি। আবার সাইন-ইন করুন।", 401);
        const next = await loadGatewayStatus(token, offset);
        if (!cancelled) {
          setStatus(next);
          setError("");
        }
      } catch (caught) {
        if (!cancelled) setError(caught instanceof Error ? caught.message : "বোর্ডের অবস্থা লোড করা যায়নি।");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), refreshIntervalMs);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [offset]);

  const boards = status?.data ?? [];

  return (
    <section id="board-status" className="board-status-panel" aria-labelledby="board-status-title">
      <div className="board-status-heading">
        <div><span className="app-eyebrow">DEVICE CONNECTIONS</span><h2 id="board-status-title">ESP32 বোর্ড ও লাইভ স্ট্যাটাস</h2><p>বোর্ডের heartbeat, সর্বশেষ API request rate এবং Wi-Fi signal account অনুযায়ী দেখুন।</p></div>
        <span className="board-refresh-label"><i /> প্রতি ৮ সেকেন্ডে আপডেট</span>
      </div>

      <div className="board-summary-grid" aria-live="polite">
        <SummaryCard label="মোট বোর্ড" value={status?.summary.total ?? (loading ? "…" : "0")} detail="এই অ্যাকাউন্টে নিবন্ধিত" />
        <SummaryCard label="এখন অনলাইন" value={status?.summary.online ?? (loading ? "…" : "0")} detail="শেষ ৪৫ সেকেন্ডে heartbeat" active />
        <SummaryCard label="অফলাইন" value={status?.summary.offline ?? (loading ? "…" : "0")} detail="heartbeat পাওয়া যাচ্ছে না" />
      </div>

      {error && <p className="board-status-error" role="alert">{error}</p>}
      {!loading && !error && boards.length === 0 && (
        <div className="board-empty-state"><span aria-hidden="true">⌁</span><div><strong>এখনো কোনো ESP32 বোর্ডের heartbeat নেই</strong><p>একটি Home তৈরি করে ESP32-S3 N16R8-এ ISYEN firmware আপলোড করুন। Wi-Fi ও account verification সফল হলে বোর্ড এখানে নিজে থেকেই যুক্ত হবে।</p></div></div>
      )}

      {boards.length > 0 && <div className="board-list">
        {boards.map((board) => <BoardCard key={board.id} board={board} />)}
      </div>}

      {status && status.pagination.total > status.pagination.limit && (
        <div className="board-pagination"><span>{status.pagination.offset + 1}–{Math.min(status.pagination.offset + status.pagination.limit, status.pagination.total)} / {status.pagination.total}</span><div>
          <button type="button" disabled={offset === 0} onClick={() => setOffset((value) => Math.max(0, value - status.pagination.limit))}>আগের</button>
          <button type="button" disabled={!status.pagination.has_more} onClick={() => setOffset((value) => value + status.pagination.limit)}>পরের</button>
        </div></div>
      )}
    </section>
  );
}

function SummaryCard({ label, value, detail, active = false }: { label: string; value: number | string; detail: string; active?: boolean }) {
  return <div className={`board-summary-card${active ? " board-summary-active" : ""}`}><span>{label}</span><strong>{value}</strong><small>{detail}</small></div>;
}

function BoardCard({ board }: { board: Gateway }) {
  const seenAt = board.last_seen_at ? Date.parse(board.last_seen_at) : Number.NaN;
  const online = board.is_online === true;
  const metadata = board.metadata ?? {};
  const rssi = typeof metadata.wifi_rssi === "number" ? `${metadata.wifi_rssi} dBm` : "—";
  const requestsPerMinute = typeof metadata.requests_per_minute === "number" ? Math.max(0, Math.round(metadata.requests_per_minute)).toLocaleString("bn-BD") : "0";
  const requestsTotal = typeof metadata.requests_total === "number" ? Math.max(0, Math.round(metadata.requests_total)).toLocaleString("bn-BD") : "0";
  const firmware = typeof metadata.firmware_version === "string" ? metadata.firmware_version : "firmware version অজানা";
  const serial = board.serial_number ? board.serial_number.match(/.{1,2}/g)?.join(":") ?? board.serial_number : "MAC অজানা";

  return <article className="board-card">
    <div className="board-card-main"><span className={`board-state-dot${online ? " board-state-online" : ""}`} aria-hidden="true" /><div className="board-card-name"><h3>{board.name}</h3><p>{serial}</p></div><span className={`board-state-badge${online ? " board-state-badge-online" : ""}`}><i />{online ? "অনলাইন" : "অফলাইন"}</span></div>
    <div className="board-card-metrics"><div><span>API request rate</span><strong>{requestsPerMinute}<small> / মিনিট</small></strong></div><div><span>মোট request</span><strong>{requestsTotal}</strong></div><div><span>Wi-Fi signal</span><strong>{rssi}</strong></div><div><span>Firmware</span><strong>{firmware}</strong></div></div>
    <p className="board-last-seen">সর্বশেষ heartbeat: {Number.isFinite(seenAt) ? new Date(seenAt).toLocaleString("bn-BD", { dateStyle: "medium", timeStyle: "short" }) : "এখনো পাওয়া যায়নি"}</p>
  </article>;
}
