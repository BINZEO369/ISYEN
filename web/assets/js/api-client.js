(() => {
  const request = async (path, options = {}) => {
    const {
      data: { session },
      error: sessionError,
    } = await window.sb.auth.getSession();
    if (sessionError) throw new Error(sessionError.message);
    if (!session?.access_token)
      throw new Error("আপনার সেশন শেষ হয়েছে। আবার লগ ইন করুন।");
    const headers = new Headers(options.headers || {});
    headers.set("apikey", window.APP_CONFIG.supabaseAnonKey);
    headers.set("Authorization", `Bearer ${session.access_token}`);
    if (options.body !== undefined)
      headers.set("Content-Type", "application/json");
    let response;
    try {
      response = await fetch(`${window.APP_CONFIG.apiBaseUrl}${path}`, {
        ...options,
        headers,
      });
    } catch (error) {
      throw new Error(error.message || "সার্ভারের সঙ্গে সংযোগ করা যাচ্ছে না।");
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
  };
  const json = (method, body) => ({ method, body: JSON.stringify(body) });
  window.Api = Object.freeze({
    dashboard: () => request("/api/dashboard"),
    createGateway: (body) => request("/api/gateways", json("POST", body)),
    updateNode: (id, body) =>
      request(`/api/nodes/${encodeURIComponent(id)}`, json("PATCH", body)),
    deleteNode: (id) =>
      request(`/api/nodes/${encodeURIComponent(id)}`, { method: "DELETE" }),
    createDevice: (body) => request("/api/devices", json("POST", body)),
    setDeviceState: (id, is_on) =>
      request(
        `/api/devices/${encodeURIComponent(id)}/state`,
        json("PATCH", { is_on }),
      ),
    deleteDevice: (id) =>
      request(`/api/devices/${encodeURIComponent(id)}`, { method: "DELETE" }),
    createSensor: (body) => request("/api/sensors", json("POST", body)),
    deleteSensor: (id) =>
      request(`/api/sensors/${encodeURIComponent(id)}`, { method: "DELETE" }),
    readings: (type) =>
      request(`/api/readings?type=${encodeURIComponent(type)}`),
  });
})();
