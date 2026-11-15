# Dashboard components

Each dashboard section is intentionally kept in one component file. `Devices.jsx` contains device UI, endpoints, and feature styling; `Sensors.jsx` contains sensor UI/readings, endpoints, and styling; `Automations.jsx` contains automation UI, endpoints, and styling; `Overview.jsx` contains gateway and node UI, endpoints, and styling. `DashboardBackground.jsx` is the single shared dashboard background component.

`DashboardShell.jsx` composes the section components and owns cross-section session/data orchestration. `shared/` is reserved for generic authenticated transport, dashboard summary/readings, and common resource-display helpers—not feature-specific UI, endpoints, or styles.
