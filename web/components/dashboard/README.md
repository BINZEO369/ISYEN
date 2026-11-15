# Dashboard feature modules

The dashboard is organized by feature. Each feature folder owns its UI components, endpoint service, and scoped CSS module:

- `devices/`: device cards, device create/state/delete endpoints, and device layout.
- `sensors/`: sensor cards and readings, sensor create/delete endpoints, and sensor layout.
- `gateways/`: gateway cards, create endpoint, and gateway layout.
- `nodes/`: pending/approved node cards, approve/delete endpoints, and node layout.
- `automations/`: automation editor/list/log UI, automation endpoints, and automation layout.

`shared/` contains the authenticated HTTP transport, dashboard summary/readings calls, and small resource display helpers. `DashboardShell.jsx` is the composition layer: it owns the signed-in dashboard session context, aggregate refresh/polling, navigation, and cross-feature orchestration. Feature-specific endpoint paths belong in that feature's `*Api.js`; feature card/layout rules belong in its CSS module. Shared color and common control tokens remain in `web/styles/globals.css` so the product retains a consistent visual theme.
