# ISYEN server API and environment configuration

The API is aligned with the existing `ISYEN HOME` Supabase schema. All tenant tables are accessed with the caller's Supabase JWT and PostgreSQL RLS remains enabled. The isolated public registration route uses the service-role key only to create the Auth/profile pair; normal REST routes never use it.

## Environment variables

| Variable | Required | Purpose |
|---|---:|---|
| `NODE_ENV` | no | `development`, `test` or `production` |
| `HOST` | no | Bind address; default `0.0.0.0` |
| `PORT` | no | Listen port; default `4000`; hosting providers may supply it |
| `LOG_LEVEL` | no | Fastify log level |
| `CORS_ORIGIN` | production | Comma-separated allowed frontend origins; wildcard is rejected in production |
| `RATE_LIMIT_MAX` | no | Requests per token/IP per window; default `120` |
| `RATE_LIMIT_WINDOW` | no | Rate-limit window; default `1 minute` |
| `SUPABASE_URL` | yes for authenticated API/readiness | `https://fabasazefdnkpygglajz.supabase.co` |
| `SUPABASE_ANON_KEY` | yes for authenticated API/readiness | Supabase publishable/anon key; server runtime only |
| `SUPABASE_SERVICE_ROLE_KEY` | yes for registration | Server-only key used exclusively by `POST /auth/register` to create the auth user and protected profile; never expose it to a browser |

The client sends `Authorization: Bearer <Supabase access token>`. The server verifies it with Supabase Auth and resolves the active/incomplete `user_profiles.isyen_id` using the same caller JWT. Tenant data queries are always scoped to that `isyen_id`; profile/admin records are additionally scoped by `auth_user_id`. Keep PostgreSQL RLS enabled.

## Health and operational endpoints

- `GET /`, `GET /health`, `GET /healthz` — unauthenticated process liveness; each returns HTTP 200 without requiring Supabase.
- `GET /ready` — unauthenticated Supabase Auth connectivity check; returns 200 when configured and reachable, otherwise 503. Database table grants/RLS are evaluated on each authenticated resource request.
- Docker exposes port 4000 and uses `/health` for its container health check. The runtime honors the supplied `PORT`.

## Account registration

`POST /auth/register` is the public signup endpoint. It accepts top-level `email`, `password` (8–72 characters), and `profile` containing every other user-editable column in the current `user_profiles` table. Home/room preference columns are intentionally absent from the active schema. The handler explicitly sets `email_confirm: true`, so this MVP does not send or require an email-verification step. The server assigns `auth_user_id`, a unique `isyen_id` (also added to the new auth user's `app_metadata`), and `profile_status`/`profile_completion`; PostgreSQL generates the profile `id` and timestamps.

The handler inserts the profile with the server-only service client because RLS intentionally forbids browser profile creation. If the profile insert fails after Auth creation, it attempts to delete the partial Auth user. Success returns HTTP 201 with the generated profile `id`, completion status and `verification_required: false`. Duplicate email returns 409. Registration requires all of `SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` in the backend runtime.

## Generic resource endpoints

`GET /api/v1` returns the supported resource names and generic route patterns; it does not return database content and does not require a token.

All table resources use the following routes:

```text
GET    /api/v1/:resource
GET    /api/v1/:resource/:id
POST   /api/v1/:resource
PATCH  /api/v1/:resource/:id
DELETE /api/v1/:resource/:id
```

## ESP32-S3 GPIO light

The signed-in dashboard can create a light with `POST /api/v1/devices` using `home_id`, `name`, `device_type_key: "esp32_s3_gpio_light"`, optional `room_id`, and `config: { "hardware": "esp32_s3_gpio_light", "gpio": 4, "desired_on": false, "active_low": false }`. The server idempotently initializes the shared `device_types` catalog entry if it is missing; the actual device row is still inserted with the caller JWT and tenant RLS. A safe GPIO can be assigned to only one light per ISYEN tenant; create/update returns HTTP 409 `GPIO_ALREADY_ASSIGNED` for a duplicate. The safe output whitelist is GPIO 4–18, 21, 38–42, 47 and 48. Boot/strapping, USB and flash/PSRAM pins are excluded.

Firmware setup asks once for Wi-Fi, account email/password and ISYEN ID. After sign-in, it verifies the entered tenant with `GET /api/v1/device-runtime/identity` and pages through `GET /api/v1/device-runtime/lights?limit=100&offset=N&order=asc` using that caller's JWT. The endpoint returns only that tenant's GPIO light rows. Firmware automatically applies each row's GPIO/desired state; no Device ID is entered for any individual light. Device IDs are read from the database response and used internally to report each output to `POST /api/v1/device-runtime/:id/state` with `{ "gpio": 4, "relay_on": false, "rssi": -55 }`. The runtime endpoint verifies that each device belongs to the JWT tenant and that the reported pin matches the stored config before updating `devices.last_seen_at` and `device_states` through the caller JWT/RLS. It does not use the service-role key for tenant data. This automatic all-lights mode assumes one ESP32 controller per ISYEN account; using multiple controllers for one account requires a future controller-to-light assignment rule.

## ESP32-S3 GPIO sensors and live readings

Create one sensor channel from the signed-in home dashboard using `POST /api/v1/devices` with `device_type_key: "esp32_s3_gpio_sensor"` and a complete config such as `{ "hardware": "esp32_s3_gpio_sensor", "gpio": 4, "input_mode": "digital", "metric": "door_open", "unit": "", "sample_interval_ms": 5000, "pull_mode": "up", "enabled": true }`. Each sensor channel is stored as a tenant-owned `devices` row, linked to one `home_id`, the shared sensor device type, its unique GPIO, and the sampling/metric configuration. Analog inputs are restricted to ADC1 GPIO 1, 2 and 4–10; digital inputs use the safe GPIO list (GPIO 1, 2, 4–18, 21, 38–42, 47, 48). A pin cannot be assigned to both a light and a sensor in the same ISYEN account. The dashboard can change a sensor's pin or enable/disable sampling; the backend validates each change, and a database unique index also protects concurrent writes.

Firmware can enumerate every configured channel for the authenticated ISYEN account by paging through `GET /api/v1/device-runtime/sensors?limit=100&offset=0`. Each row returns its database `id`, `home_id`, `name`, and `config`; firmware does not need a user to type individual sensor/device IDs. Report one actual sample to `POST /api/v1/device-runtime/:id/readings` as `{ "value": 1, "reported_at": "2026-11-12T04:00:00.000Z" }`; `reported_at` is optional. Analog values must be numeric 0–4095. Digital values must be `true`, `false`, `0` or `1`. The server checks that the device belongs to the caller's verified tenant, is an enabled sensor, and has a valid stored configuration. It derives `isyen_id`, `home_id`, `metric`, `unit`, and the stored GPIO from that row; clients cannot choose another user's home, metric or tenant. PostgreSQL records the server receive time in `sensor_data` and the database function refuses non-sensor devices or out-of-range samples.

The authenticated dashboard reads `GET /api/v1/device-runtime/sensor-readings/latest?home_id=<uuid>`, which returns only the newest stored sample for each configured sensor in that home. `sensor_data` remains RLS-protected by `current_isyen_id()`; cross-tenant requests return no other user's rows. The current `sensor_data_default` partition is already in the Supabase Realtime publication and has its own tenant RLS policy; the dashboard subscribes to inserts on that protected partition and refreshes latest values after a change, with a slower fallback refresh during transient websocket outages. It shows an explicit no-reading state until firmware reports actual data; it does not synthesize demo/default sensor readings. This GPIO channel supports raw analog/digital input; it does not claim to decode device-specific protocols such as DHT without corresponding firmware changes.

## Shared sensor catalog and home policy

The live schema enforces at most one `homes` row per `isyen_id` with the unique index `homes_one_per_isyen_id_idx`. Sensor models are shared `device_types`; each installation is a tenant-owned `devices` row, and measurements are stored in the partitioned `sensor_data` table. The shared catalog is seeded with DHT11/DHT22, MQ-2, PIR, LDR, soil moisture, smoke, flame, BMP280, ultrasonic, relay and smart-light types. These entries are reference metadata only: the runtime endpoint in this release accepts the validated `esp32_s3_gpio_sensor` raw analog/digital channel. A specific DHT/I2C/SPI sensor needs matching firmware protocol and server decoding before it can provide live readings; catalog presence alone does not create fake data or imply protocol support.

Every resource endpoint requires a verified Bearer token. List parameters are `limit` (1–100, default 50), `offset` (0–1,000,000, default 0), `order_by`, and `order` (`asc` or `desc`). Only table-specific filters and sort columns are accepted; unsupported names/values return HTTP 400. List responses are `{ data, pagination: { limit, offset, total, total_is_estimate, has_more } }`. The database count is planner-estimated to avoid an exact-count scan on high-volume tables.

Responses use explicit safe column projections: internal `auth_user_id`/`isyen_id` are omitted; gateway `connection_config`, integration `config` and `credentials_ref` are never returned. Profile projection/writes follow the active table columns; unsupported request fields are rejected instead of sent to PostgreSQL.

## Resource permissions

| Resource | Read | User write | Scope / notes |
|---|---:|---:|---|
| `homes` | yes | CRUD | Tenant-scoped |
| `home_settings` | yes | CRUD | Tenant-scoped; one row per home |
| `rooms` | yes | CRUD | Tenant-scoped |
| `zones` | yes | CRUD | Tenant-scoped |
| `devices` | yes | CRUD | Device configuration; status and last-seen are server-managed |
| `device_types` | yes | no | Shared authenticated reference data |
| `gateways` | yes | CRUD | Connection secrets/config are not exposed or user-writable |
| `device_states` | yes | no | Device/gateway-reported state |
| `device_logs` | yes | no | Append-only operational history |
| `automations` | yes | CRUD | Trigger/condition/action JSON objects |
| `automation_logs` | yes | no | Execution history |
| `scenes` | yes | CRUD | Scene definitions |
| `scene_devices` | yes | CRUD | Scene-to-device commands |
| `schedules` | yes | CRUD | Must reference a scene or automation |
| `sensor_data` | yes | no | High-volume telemetry; reported only through the validated sensor runtime endpoint/database function |
| `notifications` | yes | no | Server-created notifications |
| `integrations` | yes | limited CRUD | Provider/account identifiers only; provider config/credentials are backend-managed |
| `firmware_updates` | yes | no | Server/gateway controlled |
| `security_events` | yes | no | Server-created security events |
| `admin_users` | self only | no | Own active record only; role changes remain backend-controlled |
| `user_profiles` | self only | update | Profile creation/status changes remain backend-controlled |

Service-managed write resources return HTTP 403 from user CRUD routes. Profile and admin queries are explicitly restricted to the authenticated `auth_user_id`, as well as tenant scoping and RLS.

## HTTP error behavior

- `400` — invalid request body, filter, pagination or sort field.
- `401` — missing/invalid token or no eligible profile.
- `403` — user API attempts to write a service-managed resource.
- `404` — unknown resource or row outside the caller's visible scope.
- `409` — unique constraint conflict.
- `422` — invalid foreign-key reference or database check constraint.
- `503` — Supabase/auth provider unavailable or server integration not configured.

Database error text and credentials are not returned to clients or logged; only the database error code and operation are recorded.

## Security rules

- Never put `SUPABASE_SERVICE_ROLE_KEY` in `app/`, `management/`, browser bundles, `.env.example` with a real value, logs, or Git history.
- The API sets `isyen_id` from the resolved caller profile and rejects protected/internal fields from request bodies.
- Shared and tenant-scoped reads both use the caller JWT; the server does not use a service-role client for normal REST requests.
- Admin/profile reads are self-only. User profile creation/deletion and account status are backend-controlled.
- Use pagination for every list read; `limit` is capped at 100.
- High-volume telemetry/log writes remain server-managed; do not expose direct user CRUD writes for those tables.
