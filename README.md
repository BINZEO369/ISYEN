# ISYEN Home Automation

ISYEN হলো Supabase Auth/RLS-ভিত্তিক smart-home control dashboard। Frontend **Next.js App Router + React + JavaScript**; API হলো আলাদা **Node.js** service। UI Bengali-first, responsive, এবং single-file HTML নয়। `admin/` এই scope-এর বাইরে এবং অপরিবর্তিত।

## Professional project structure

```text
src/
  app/
    layout.jsx              # metadata, Bengali document root, global stylesheet
    page.jsx                # Next.js route
  components/
    App.jsx                 # auth/session bootstrap
    AuthScreen.jsx          # login + registration
    DashboardShell.jsx      # dashboard composition, forms and live data
    ResourceCards.jsx       # gateway/node/device/sensor views
    Feedback.jsx            # reusable loading, modal, toast
  services/
    api.js                  # authenticated REST API client
    config.js               # Supabase client + public runtime config
  styles/
    globals.css             # responsive visual system
api/index.js                # JWT/RLS-secured Node API handler
server.js                   # standalone Node API host entrypoint
test/api.test.js             # API security/behavior tests
```

## Dashboard features

- Supabase email/password registration, login and logout
- Gateway creation and server-generated ESP32 claim code
- Pending Sub Node approval/rename; confirmed deletion removes child devices/sensors first
- Device/light create, toggle and delete
- DHT11/DHT22, MQ2/MQ135, PIR and REED sensor create/delete and latest readings
- PIR/REED allowed only on approved Sub Nodes; configurable HIGH/LOW trigger
- Gateway online/offline status, realtime updates and fast/slow reading polling
- Responsive mobile sidebar, clear loading/error/empty states, accessible controls and confirmation dialogs

## Local development

Use Node.js **20.9+**. Node 22 is recommended for the Next.js version in this project.

```sh
cp .env.example .env
# Set Supabase public URL/key and local API URL in .env
npm install
```

Run the app and API in separate terminals:

```sh
# Terminal 1: the standalone Node.js API, default port 3001
npm run start:api

# Terminal 2: Next.js + React development app, default port 3000
npm run dev
```

Open `http://localhost:3000`. `.env` values are read by Next.js and by the standalone API server. `NEXT_PUBLIC_*` values are deliberately public and are bundled into browser code; never put a service-role/secret key in them.

```sh
npm run build       # production Next.js build
npm start            # Next.js production server (after build)
npm run check        # Node source syntax checks
npm test             # API auth, RLS mapping, validation and deletion behavior
```

## Supabase and API security

Authenticated API calls send the Supabase access token as `Authorization: Bearer <token>` and the publishable/anon key in `apikey`. The Node API validates the token with Supabase Auth and issues database requests under the same user JWT, so existing Row Level Security enforces ownership. The API validates GPIO pins, sensor type, ownership of the approved Sub Node and request size. It does not use a service-role key and does not require a schema migration.

| Method         | Endpoint                            | Purpose                                               |
| -------------- | ----------------------------------- | ----------------------------------------------------- |
| GET            | `/api/health`                       | API health check                                      |
| GET            | `/api/config`                       | Browser-safe API-host runtime information             |
| GET            | `/api/dashboard`                    | Gateways, nodes, devices, sensors and latest readings |
| GET            | `/api/readings?type=fast\|slow`     | Latest sensor readings by polling group               |
| POST           | `/api/gateways`                     | Create gateway and claim code for the logged-in owner |
| PATCH / DELETE | `/api/nodes/:id`                    | Approve/rename or delete Sub Node                     |
| POST / DELETE  | `/api/devices` · `/api/devices/:id` | Create/delete device                                  |
| PATCH          | `/api/devices/:id/state`            | Toggle device state                                   |
| POST / DELETE  | `/api/sensors` · `/api/sensors/:id` | Create/delete sensor                                  |

## Vercel website + separate Node API host

### Next.js website on Vercel

Import the repository as a **Next.js** project; Vercel auto-detects `next build`. Set these Project Environment Variables for the deployment environment:

- `NEXT_PUBLIC_SUPABASE_URL` = Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` = Supabase publishable/anon key (public by design)
- `NEXT_PUBLIC_API_BASE_URL` = the separate Node API HTTPS origin, e.g. `https://api.example.com`

Redeploy after changing values. `NEXT_PUBLIC_API_BASE_URL` is the API origin only; frontend calls append `/api/...`.

### Separate Node.js API host

Deploy the same repository to a Node host and use start command `npm run start:api`. Configure:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY` (publishable/anon key; **not** service-role)
- `ALLOWED_ORIGINS` = exact frontend origin(s), comma-separated
- Host-provided `PORT`

Allow the Vercel/custom website origin in `ALLOWED_ORIGINS`. Use HTTPS and do not set `SUPABASE_SERVICE_ROLE_KEY`.

## Database / Admin

Uses existing Supabase `gateways`, `nodes`, `devices`, `device_states`, `sensors`, and `sensor_readings` tables, RLS policies and triggers. No production schema/data change was made. `admin/index.js` and the admin UI remain untouched.
