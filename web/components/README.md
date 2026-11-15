# Frontend component structure

- `Header.jsx` and `Footer.jsx` are the separate site-wide navigation components.
- `Home.jsx` contains the landing-page UI; `app/page.jsx` only calls it.
- `AuthScreen.jsx` owns sign-in/sign-up UI and its auth endpoint requests.
- `Dashboard.jsx` owns session protection, API transport, refresh/polling, and calls the dashboard sections.
- `Overview.jsx`, `Devices.jsx`, `Sensors.jsx`, and `Automations.jsx` each contain that section's UI, endpoint calls, and styles.
- `UI.jsx` contains only reused primitives: modal, toast, loading, empty-state and display helpers.

App route files are intentionally thin: they import the relevant component and provide route metadata/section name. The API server remains responsible for validation, business rules and database access.
