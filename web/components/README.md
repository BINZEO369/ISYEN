# Dashboard components

Each dashboard section is intentionally kept in one component file. `Devices.jsx` contains device UI, endpoint calls, and feature styling; `Sensors.jsx` contains sensor UI/readings, endpoint calls, and styling; `Automations.jsx` contains automation UI, endpoint calls, and styling; `Overview.jsx` contains gateway and node UI, endpoint calls, and styling. `DashboardBackground.jsx` is the single shared dashboard background component.

`DashboardShell.jsx` composes the section components and handles cross-section session state, endpoint requests, rendering state, and refresh timing. Generic support files (`request.js`, `dashboardApi.js`, and `resourceHelpers.jsx`) sit directly in this folder; there is no nested dashboard/shared folder.

All database access, authorization, business validation, and mutation decisions are owned by the separate `api/` service. The browser only calls `/api/*` endpoints and keeps the UI/form state needed to render and submit the dashboard. Server-supplied choices and constraints are returned by `GET /api/options`; client-side input attributes are UX hints only, never the authoritative validation.