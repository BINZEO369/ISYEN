(() => {
  const $ = (id) => document.getElementById(id);
  const esc = (value) =>
    String(value ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  const state = {
    user: null,
    signup: false,
    gateways: [],
    nodes: [],
    devices: [],
    sensors: [],
    readings: {},
    channel: null,
    timers: [],
    loading: false,
    toastTimer: null,
  };
  const { devicePins, sensorPins } = window.APP_CONFIG;
  const idEq = (a, b) => String(a) === String(b);

  document.addEventListener("DOMContentLoaded", init);
  async function init() {
    fillPins($("devicePin"), devicePins);
    fillPins($("sensorPin"), sensorPins);
    $("auth-form").addEventListener("submit", authenticate);
    $("gateway-form").addEventListener("submit", saveGateway);
    $("device-form").addEventListener("submit", saveDevice);
    $("sensor-form").addEventListener("submit", saveSensor);
    document.addEventListener("click", delegatedClick);
    $("sensorType").addEventListener("change", syncSensorOptions);
    $("sensorGateway").addEventListener("change", syncSensorOptions);
    $("sensorNode").addEventListener("change", validateSensorNode);
    $("deviceGateway").addEventListener("change", fillDeviceNodes);
    document.querySelectorAll(".modal").forEach((modal) =>
      modal.addEventListener("click", (e) => {
        if (e.target === modal) closeModal(modal.id);
      }),
    );
    try {
      await window.APP_CONFIG_READY;
      const {
        data: { session },
      } = await sb.auth.getSession();
      if (session) await showDashboard(session.user);
      else showAuth();
      sb.auth.onAuthStateChange((_, session) => {
        if (session) void showDashboard(session.user);
        else {
          stopUpdates();
          showAuth();
        }
      });
    } catch (e) {
      showAuth();
      toast(e.message, true);
    }
  }
  function fillPins(select, pins) {
    select.innerHTML = pins
      .map((pin) => `<option value="${pin}">GPIO ${pin}</option>`)
      .join("");
  }
  function showAuth() {
    $("auth-screen").hidden = false;
    $("main-app").hidden = true;
  }
  async function authenticate(event) {
    event.preventDefault();
    const email = $("auth-email").value.trim(),
      password = $("auth-password").value;
    try {
      const result = state.signup
        ? await sb.auth.signUp({ email, password })
        : await sb.auth.signInWithPassword({ email, password });
      if (result.error) throw result.error;
      if (state.signup && !result.data.session) {
        toast("অ্যাকাউন্ট তৈরি হয়েছে—ইমেইল যাচাই করে লগ ইন করুন।");
        toggleAuth();
        $("auth-form").reset();
      }
    } catch (e) {
      toast(e.message || "লগ ইন করা যায়নি।", true);
    }
  }
  function toggleAuth() {
    state.signup = !state.signup;
    $("auth-btn").textContent = state.signup
      ? "অ্যাকাউন্ট তৈরি করুন"
      : "লগ ইন করুন";
    $("auth-switch-text").textContent = state.signup
      ? "আগে থেকেই অ্যাকাউন্ট আছে?"
      : "নতুন অ্যাকাউন্ট তৈরি করবেন?";
    document.querySelector('[data-action="toggle-auth"]').textContent =
      state.signup ? "লগ ইন" : "সাইন আপ";
  }
  async function showDashboard(user) {
    if (!user || state.loading) return;
    state.user = user;
    $("auth-screen").hidden = true;
    $("main-app").hidden = false;
    $("user-email").textContent = user.email || "";
    $("loading-state").hidden = false;
    $("dashboard-content").hidden = true;
    try {
      await refreshDashboard();
      $("loading-state").hidden = true;
      $("dashboard-content").hidden = false;
      subscribeRealtime();
      startPolling();
    } catch (e) {
      $("loading-state").hidden = true;
      $("dashboard-content").hidden = false;
      toast(e.message, true);
    }
  }
  async function refreshDashboard() {
    if (state.loading) return;
    state.loading = true;
    try {
      const data = await Api.dashboard();
      state.gateways = Array.isArray(data?.gateways) ? data.gateways : [];
      state.nodes = Array.isArray(data?.nodes) ? data.nodes : [];
      state.devices = (Array.isArray(data?.devices) ? data.devices : []).map(
        (d) => ({
          ...d,
          isOn: Array.isArray(d.device_states)
            ? Boolean(d.device_states[0]?.is_on)
            : Boolean(d.device_states?.is_on),
        }),
      );
      state.sensors = Array.isArray(data?.sensors) ? data.sensors : [];
      state.readings = {};
      (data?.readings || []).forEach((r) => {
        if (r.sensor_id != null) state.readings[r.sensor_id] = r;
      });
      renderAll();
    } finally {
      state.loading = false;
    }
  }
  function renderAll() {
    $("stat-gateways").textContent = state.gateways.length;
    $("stat-nodes").textContent = state.nodes.filter(
      (n) => n.is_approved,
    ).length;
    $("stat-devices").textContent = state.devices.length;
    $("stat-sensors").textContent = state.sensors.length;
    renderGateways();
    renderNodes();
    renderDevices();
    renderSensors();
  }
  function empty(text) {
    return `<div class="empty-state">${esc(text)}</div>`;
  }
  function renderGateways() {
    $("gatewayGrid").innerHTML = state.gateways.length
      ? state.gateways
          .map((g) => {
            const online = Boolean(
              g.last_seen &&
                Date.now() - new Date(g.last_seen).getTime() < 90000,
            );
            const badge = g.mac_address
              ? `<span class="status ${online ? "" : "offline"}">● ${online ? "Online" : "Offline"}</span>`
              : `<span class="badge code">Claim Code · ${esc(g.claim_code || "—")}</span>`;
            return `<article class="card"><div class="card-top"><div><div class="card-title">${esc(g.gateway_name)}</div><div class="card-sub">MAC · ${esc(g.mac_address || "সংযোগের অপেক্ষায়")}</div></div>${badge}</div><div class="badge-row">${g.last_seen ? `<span class="badge">সর্বশেষ · ${esc(formatTime(g.last_seen))}</span>` : ""}</div></article>`;
          })
          .join("")
      : empty("এখনও কোনো Gateway যোগ করা হয়নি। শুরু করতে Gateway যোগ করুন।");
  }
  function renderNodes() {
    const pending = state.nodes.filter((n) => !n.is_approved),
      approved = state.nodes.filter((n) => n.is_approved);
    $("pending-section").hidden = !pending.length;
    $("pending-count").textContent = pending.length
      ? `${pending.length}টি অপেক্ষমাণ`
      : "";
    $("pendingGrid").innerHTML = pending
      .map(
        (n) =>
          `<article class="card pending"><div class="card-top"><div><div class="card-title">নতুন Node শনাক্ত হয়েছে</div><div class="card-sub">MAC · ${esc(n.mac_address)}</div></div><span class="status offline">অনুমোদন প্রয়োজন</span></div><div class="card-actions"><button class="btn btn-primary" data-action="approve-node" data-id="${esc(n.id)}">অনুমোদন দিন</button></div></article>`,
      )
      .join("");
    $("nodeGrid").innerHTML = approved.length
      ? approved
          .map((n) => {
            const gw = state.gateways.find((g) => idEq(g.id, n.gateway_id));
            return `<article class="card"><div class="card-top"><div><div class="card-title">${esc(n.node_name || "Sub Node")}</div><div class="card-sub">${esc(gw?.gateway_name || "Gateway")} · MAC ${esc(n.mac_address)}</div></div><span class="status">অনুমোদিত</span></div><div class="card-actions"><span class="badge">Sub Node</span><button class="icon-button" data-action="delete-node" data-id="${esc(n.id)}">মুছুন</button></div></article>`;
          })
          .join("")
      : empty("এখনও কোনো Sub Node অনুমোদিত হয়নি।");
  }
  function renderDevices() {
    $("lightGrid").innerHTML = state.devices.length
      ? state.devices
          .map((d) => {
            const gw = state.gateways.find((g) => idEq(g.id, d.gateway_id));
            const node =
              d.node_id && Number(d.node_id) !== 0
                ? state.nodes.find((n) => idEq(n.id, d.node_id))?.node_name ||
                  "অজানা Node"
                : "Main Board";
            return `<article class="card"><div class="card-top"><div><div class="card-title">${esc(d.device_name)}</div><div class="card-sub">${esc(gw?.gateway_name || "Gateway")} · ${esc(node)}</div></div><span class="status ${d.isOn ? "" : "offline"}">${d.isOn ? "ON" : "OFF"}</span></div><div class="badge-row"><span class="badge">GPIO ${esc(d.pin)}</span></div><div class="card-actions"><button class="toggle ${d.isOn ? "on" : ""}" role="switch" aria-checked="${d.isOn}" aria-label="${esc(d.device_name)} চালু বা বন্ধ" data-action="toggle-device" data-id="${esc(d.id)}"></button><button class="icon-button" data-action="delete-device" data-id="${esc(d.id)}">মুছুন</button></div></article>`;
          })
          .join("")
      : empty("এখনও কোনো আলো বা ডিভাইস যোগ করা হয়নি।");
  }
  function latest(value) {
    if (Array.isArray(value))
      return value.length ? value[value.length - 1] : null;
    return value ?? null;
  }
  function readingView(sensor, r) {
    if (!r)
      return '<div class="sensor-reading"><span class="reading-label">এখনও কোনো reading পাওয়া যায়নি</span></div>';
    if (sensor.sensor_type === "PIR" || sensor.sensor_type === "REED") {
      const raw = latest(
          sensor.sensor_type === "PIR" ? r.motion : r.door_state,
        ),
        active = raw == null ? null : Number(raw) === 1;
      const label =
        active === null
          ? "NO DATA"
          : sensor.sensor_type === "PIR"
            ? active
              ? "MOTION"
              : "CLEAR"
            : active
              ? "OPEN"
              : "CLOSED";
      return `<div class="sensor-reading"><div><div class="reading-value">${label}</div><div class="reading-label">${sensor.sensor_type === "PIR" ? "Motion Status" : "Door / Window Status"}</div></div><div><div class="reading-value" style="font-size:12px">${esc(formatTime(r.created_at))}</div><div class="reading-label">সর্বশেষ আপডেট</div></div></div>`;
    }
    if (sensor.sensor_type.startsWith("MQ")) {
      const gas = latest(r.gas_value);
      return `<div class="sensor-reading"><div><div class="reading-value">${gas == null ? "—" : esc(Number(gas).toFixed(0))}</div><div class="reading-label">Gas Value</div></div></div>`;
    }
    const t = latest(r.temperature),
      h = latest(r.humidity);
    return `<div class="sensor-reading"><div><div class="reading-value">${t == null ? "—" : esc(Number(t).toFixed(1))}°C</div><div class="reading-label">তাপমাত্রা</div></div><div><div class="reading-value">${h == null ? "—" : esc(Number(h).toFixed(1))}%</div><div class="reading-label">আর্দ্রতা</div></div></div>`;
  }
  function renderSensors() {
    $("sensorGrid").innerHTML = state.sensors.length
      ? state.sensors
          .map((s) => {
            const gw = state.gateways.find((g) => idEq(g.id, s.gateway_id));
            const node =
              s.node_id && Number(s.node_id) !== 0
                ? state.nodes.find((n) => idEq(n.id, s.node_id))?.node_name ||
                  "অজানা Node"
                : "Main Board";
            const trigger =
              s.sensor_type === "PIR" || s.sensor_type === "REED"
                ? `<span class="badge">Trigger · ${esc(s.pir_trigger_state || "HIGH")}</span>`
                : "";
            return `<article class="card"><div class="card-top"><div><div class="card-title">${esc(s.sensor_name)}</div><div class="card-sub">${esc(gw?.gateway_name || "Gateway")} · ${esc(node)}</div></div><span class="status">${esc(s.sensor_type)}</span></div><div class="badge-row"><span class="badge">GPIO ${esc(s.pin)}</span>${trigger}</div>${readingView(s, state.readings[s.id])}<div class="card-actions"><span class="reading-label">${s.sensor_type === "PIR" || s.sensor_type === "REED" ? "Fast polling" : "Sensor reading"}</span><button class="icon-button" data-action="delete-sensor" data-id="${esc(s.id)}">মুছুন</button></div></article>`;
          })
          .join("")
      : empty("এখনও কোনো সেন্সর যোগ করা হয়নি।");
  }
  function formatTime(iso) {
    if (!iso) return "—";
    const sec = Math.max(
      0,
      Math.floor((Date.now() - new Date(iso).getTime()) / 1000),
    );
    return sec < 60
      ? `${sec}s আগে`
      : sec < 3600
        ? `${Math.floor(sec / 60)}m আগে`
        : sec < 86400
          ? `${Math.floor(sec / 3600)}h আগে`
          : `${Math.floor(sec / 86400)}d আগে`;
  }
  function gatewayOptions(select) {
    select.innerHTML = state.gateways
      .map(
        (g) => `<option value="${esc(g.id)}">${esc(g.gateway_name)}</option>`,
      )
      .join("");
  }
  function nodeOptions(select, gatewayId, subOnly = false) {
    const approved = state.nodes.filter(
      (n) => idEq(n.gateway_id, gatewayId) && n.is_approved,
    );
    select.innerHTML =
      `<option value="0" ${subOnly ? "disabled" : ""}>Main ESP32 (Gateway)</option>` +
      approved
        .map(
          (n) =>
            `<option value="${esc(n.id)}">${esc(n.node_name || "Sub Node")}</option>`,
        )
        .join("");
    if (subOnly && approved.length) select.value = approved[0].id;
  }
  function openModal(id) {
    $(id).classList.add("active");
    $(id).setAttribute("aria-hidden", "false");
    const input = $(id).querySelector("input");
    if (input) input.focus();
  }
  function closeModal(id) {
    const modal = $(id);
    if (modal) {
      modal.classList.remove("active");
      modal.setAttribute("aria-hidden", "true");
    }
  }
  function closeAll() {
    document.querySelectorAll(".modal.active").forEach((m) => closeModal(m.id));
  }
  function openDevice() {
    if (!state.gateways.length)
      return toast("আগে একটি Gateway যোগ করুন।", true);
    $("device-form").reset();
    gatewayOptions($("deviceGateway"));
    fillDeviceNodes();
    openModal("deviceModal");
  }
  function fillDeviceNodes() {
    nodeOptions($("deviceNode"), $("deviceGateway").value, false);
  }
  function openSensor() {
    if (!state.gateways.length)
      return toast("আগে একটি Gateway যোগ করুন।", true);
    $("sensor-form").reset();
    gatewayOptions($("sensorGateway"));
    syncSensorOptions();
    openModal("sensorModal");
  }
  function syncSensorOptions() {
    const type = $("sensorType").value,
      subOnly = type === "PIR" || type === "REED";
    $("pirTriggerGroup").hidden = type !== "PIR";
    $("reedTriggerGroup").hidden = type !== "REED";
    nodeOptions($("sensorNode"), $("sensorGateway").value, subOnly);
    validateSensorNode();
  }
  function validateSensorNode() {
    const type = $("sensorType").value,
      subOnly = type === "PIR" || type === "REED",
      noNodes = !state.nodes.some(
        (n) => idEq(n.gateway_id, $("sensorGateway").value) && n.is_approved,
      );
    const invalid =
      subOnly &&
      (noNodes || !$("sensorNode").value || $("sensorNode").value === "0");
    $("sensorWarning").hidden = !invalid;
    $("sensorWarning").textContent = noNodes
      ? `${type} সেন্সরের জন্য অন্তত একটি অনুমোদিত Sub Node প্রয়োজন।`
      : `${type} সেন্সর শুধু অনুমোদিত Sub Node-এ যোগ করা যাবে।`;
    $("sensorSaveBtn").disabled = invalid;
  }
  async function saveGateway(e) {
    e.preventDefault();
    const name = $("gatewayName").value.trim();
    if (!name) return;
    try {
      const result = await Api.createGateway({ gateway_name: name });
      closeAll();
      toast(
        `Gateway তৈরি হয়েছে${result?.claim_code ? ` · Claim Code ${result.claim_code}` : ""}`,
      );
      await refreshDashboard();
    } catch (err) {
      toast(err.message, true);
    }
  }
  async function saveDevice(e) {
    e.preventDefault();
    const payload = {
      gateway_id: Number($("deviceGateway").value),
      node_id: Number($("deviceNode").value),
      device_name: $("deviceName").value.trim(),
      pin: Number($("devicePin").value),
    };
    if (!window.APP_CONFIG.devicePins.includes(payload.pin))
      return toast("নিরাপদ GPIO Pin নির্বাচন করুন।", true);
    try {
      await Api.createDevice(payload);
      closeAll();
      toast("ডিভাইস যোগ হয়েছে।");
      await refreshDashboard();
    } catch (err) {
      toast(err.message, true);
    }
  }
  async function saveSensor(e) {
    e.preventDefault();
    const type = $("sensorType").value,
      nodeId = Number($("sensorNode").value),
      pin = Number($("sensorPin").value);
    if ((type === "PIR" || type === "REED") && nodeId === 0)
      return toast(`${type} শুধু Sub Node-এ যোগ করা যাবে।`, true);
    if (!window.APP_CONFIG.sensorPins.includes(pin))
      return toast("নিরাপদ GPIO Pin নির্বাচন করুন।", true);
    const payload = {
      gateway_id: Number($("sensorGateway").value),
      node_id: nodeId,
      sensor_name: $("sensorName").value.trim(),
      pin,
      sensor_type: type,
      pir_trigger_state:
        type === "PIR"
          ? $("pirTriggerState").value
          : type === "REED"
            ? $("reedTriggerState").value
            : "HIGH",
    };
    try {
      await Api.createSensor(payload);
      closeAll();
      toast("সেন্সর যোগ হয়েছে।");
      await refreshDashboard();
    } catch (err) {
      toast(err.message, true);
    }
  }
  async function delegatedClick(e) {
    const button = e.target.closest("[data-action]");
    if (!button) return;
    const action = button.dataset.action,
      id = button.dataset.id;
    if (action === "toggle-auth") return toggleAuth();
    if (action === "close-modal") return closeAll();
    if (action === "open-gateway") {
      $("gateway-form").reset();
      return openModal("gatewayModal");
    }
    if (action === "open-device") return openDevice();
    if (action === "open-sensor") return openSensor();
    if (action === "logout") {
      stopUpdates();
      const { error } = await sb.auth.signOut();
      if (error) toast(error.message, true);
      return;
    }
    if (action === "approve-node") return approveNode(id);
    if (action === "delete-node") return deleteNode(id);
    if (action === "toggle-device") return toggleDevice(id, button);
    if (action === "delete-device") return deleteDevice(id);
    if (action === "delete-sensor") return deleteSensor(id);
  }
  async function approveNode(id) {
    const node = state.nodes.find((n) => idEq(n.id, id));
    if (!node) return;
    const name = window.prompt("এই Node-এর নাম লিখুন:", "Room Node");
    if (!name?.trim()) return;
    try {
      await Api.updateNode(id, { node_name: name.trim(), is_approved: true });
      toast("Node অনুমোদিত হয়েছে।");
      await refreshDashboard();
    } catch (e) {
      toast(e.message, true);
    }
  }
  async function deleteNode(id) {
    const node = state.nodes.find((n) => idEq(n.id, id));
    const d = state.devices.filter((x) => idEq(x.node_id, id)).length,
      s = state.sensors.filter((x) => idEq(x.node_id, id)).length;
    if (
      !window.confirm(
        `“${node?.node_name || "Node"}” মুছবেন? এর সঙ্গে ${d}টি ডিভাইস ও ${s}টি সেন্সরও মুছে যাবে।`,
      )
    )
      return;
    try {
      await Api.deleteNode(id);
      toast("Node মুছে ফেলা হয়েছে।");
      await refreshDashboard();
    } catch (e) {
      toast(e.message, true);
    }
  }
  async function toggleDevice(id, button) {
    const device = state.devices.find((d) => idEq(d.id, id));
    if (!device) return;
    const next = !device.isOn;
    device.isOn = next;
    renderDevices();
    try {
      await Api.setDeviceState(id, next);
      await refreshDashboard();
    } catch (e) {
      device.isOn = !next;
      renderDevices();
      toast(e.message, true);
    }
  }
  async function deleteDevice(id) {
    if (!window.confirm("এই ডিভাইসটি মুছবেন?")) return;
    try {
      await Api.deleteDevice(id);
      toast("ডিভাইস মুছে ফেলা হয়েছে।");
      await refreshDashboard();
    } catch (e) {
      toast(e.message, true);
    }
  }
  async function deleteSensor(id) {
    if (!window.confirm("এই সেন্সরটি মুছবেন?")) return;
    try {
      await Api.deleteSensor(id);
      toast("সেন্সর মুছে ফেলা হয়েছে।");
      await refreshDashboard();
    } catch (e) {
      toast(e.message, true);
    }
  }
  function subscribeRealtime() {
    if (state.channel) void sb.removeChannel(state.channel);
    state.channel = sb
      .channel("dashboard-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "gateways" },
        debouncedRefresh,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "nodes" },
        debouncedRefresh,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "devices" },
        debouncedRefresh,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "device_states" },
        debouncedRefresh,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "sensors" },
        debouncedRefresh,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "sensor_readings" },
        debouncedRefresh,
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT")
          console.warn("Realtime unavailable; polling remains active.");
      });
  }
  let refreshDebounce;
  function debouncedRefresh() {
    clearTimeout(refreshDebounce);
    refreshDebounce = setTimeout(
      () => void refreshDashboard().catch((e) => console.warn(e)),
      500,
    );
  }
  function startPolling() {
    clearInterval(state.timers[0]);
    clearInterval(state.timers[1]);
    state.timers = [
      setInterval(() => void pollReadings("fast"), 3000),
      setInterval(() => void pollReadings("slow"), 20000),
    ];
  }
  async function pollReadings(type) {
    if (!state.user) return;
    const has = state.sensors.some((s) =>
      type === "fast"
        ? s.sensor_type === "PIR" || s.sensor_type === "REED"
        : s.sensor_type !== "PIR" && s.sensor_type !== "REED",
    );
    if (!has) return;
    try {
      const result = await Api.readings(type);
      const rows = Array.isArray(result)
        ? result
        : Array.isArray(result?.readings)
          ? result.readings
          : [];
      rows.forEach((r) => {
        if (r.sensor_id != null) state.readings[r.sensor_id] = r;
      });
      renderSensors();
    } catch (e) {
      console.debug("Reading poll failed:", e.message);
    }
  }
  function stopUpdates() {
    state.user = null;
    if (state.channel) {
      void sb.removeChannel(state.channel);
      state.channel = null;
    }
    state.timers.forEach(clearInterval);
    state.timers = [];
    clearTimeout(refreshDebounce);
  }
  function toast(message, error = false) {
    const el = $("toast");
    el.textContent = message;
    el.classList.toggle("error", error);
    el.classList.add("show");
    clearTimeout(state.toastTimer);
    state.toastTimer = setTimeout(() => el.classList.remove("show"), 3500);
  }
})();
