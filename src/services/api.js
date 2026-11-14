import { getRuntime, getSupabase } from "./config";

async function request(path, options = {}) {
  const [config, supabase] = await Promise.all([getRuntime(), getSupabase()]);
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();
  if (error) throw error;
  if (!session?.access_token)
    throw new Error("আপনার সেশন শেষ হয়েছে। আবার লগ ইন করুন।");
  const headers = new Headers(options.headers || {});
  headers.set("apikey", config.supabaseAnonKey);
  headers.set("Authorization", `Bearer ${session.access_token}`);
  headers.set("Accept", "application/json");
  if (options.body !== undefined)
    headers.set("Content-Type", "application/json");
  let response;
  try {
    response = await fetch(`${config.apiBaseUrl}${path}`, {
      ...options,
      headers,
    });
  } catch (e) {
    throw new Error(e.message || "সার্ভারের সঙ্গে সংযোগ করা যাচ্ছে না।");
  }
  const raw = await response.text();
  let payload = null;
  if (raw) {
    try {
      payload = JSON.parse(raw);
    } catch {
      throw new Error("সার্ভার থেকে সঠিক JSON উত্তর আসেনি।");
    }
  }
  if (!response.ok) {
    const message =
      payload?.error ||
      payload?.message ||
      payload?.details ||
      `অনুরোধ ব্যর্থ হয়েছে (${response.status})`;
    throw new Error(
      typeof message === "string" ? message : JSON.stringify(message),
    );
  }
  return payload;
}
const json = (method, body) => ({ method, body: JSON.stringify(body) });
const id = (value) => encodeURIComponent(value);
export const api = {
  dashboard: () => request("/api/dashboard"),
  readings: (type) => request(`/api/readings?type=${encodeURIComponent(type)}`),
  createGateway: (body) => request("/api/gateways", json("POST", body)),
  updateNode: (key, body) =>
    request(`/api/nodes/${id(key)}`, json("PATCH", body)),
  deleteNode: (key) => request(`/api/nodes/${id(key)}`, { method: "DELETE" }),
  createDevice: (body) => request("/api/devices", json("POST", body)),
  setDeviceState: (key, is_on) =>
    request(`/api/devices/${id(key)}/state`, json("PATCH", { is_on })),
  deleteDevice: (key) =>
    request(`/api/devices/${id(key)}`, { method: "DELETE" }),
  createSensor: (body) => request("/api/sensors", json("POST", body)),
  deleteSensor: (key) =>
    request(`/api/sensors/${id(key)}`, { method: "DELETE" }),
};
