# ISYEN server API and environment configuration

## Environment variables

| Variable | Required | Purpose |
|---|---:|---|
| `NODE_ENV` | no | `development`, `test` or `production` |
| `HOST` | no | Bind address; default `0.0.0.0` |
| `PORT` | no | Fastify port; default `4000` |
| `LOG_LEVEL` | no | Fastify log level |
| `CORS_ORIGIN` | yes in production | Allowed frontend origin; avoid `*` with credentials |
| `RATE_LIMIT_MAX` | no | Requests per window; default `120` |
| `RATE_LIMIT_WINDOW` | no | Rate-limit window; default `1 minute` |
| `SUPABASE_URL` | yes for API | `https://fabasazefdnkpygglajz.supabase.co` |
| `SUPABASE_ANON_KEY` | yes for API | Public anon/publishable key; used with the caller Bearer token |
| `SUPABASE_SERVICE_ROLE_KEY` | yes for readiness/tenant resolution | Server-only key; never send to browsers or commit to Git |

The client sends `Authorization: Bearer <Supabase access token>`. The server validates the token with Supabase Auth, resolves `user_profiles.isyen_id`, then queries through a user-scoped Supabase client. RLS remains the database-level defense-in-depth layer.

## Generic endpoint contract

All database resources use the following routes:

```text
GET    /api/v1/:resource
GET    /api/v1/:resource/:id
POST   /api/v1/:resource
PATCH  /api/v1/:resource/:id
DELETE /api/v1/:resource/:id
```

List query parameters: `limit` (1–100), `offset`, `order_by`, `order`, `home_id`, `room_id`, `device_id`, `is_read`, and `status`. Responses use `{ data }`; list responses also include `{ pagination: { limit, offset, total } }`.

## Resource matrix

| Resource | Read | User write | Service-only notes |
|---|---:|---:|---|
| `homes` | yes | CRUD | Tenant-scoped |
| `home_settings` | yes | CRUD | One row per home |
| `rooms` | yes | CRUD | Tenant-scoped |
| `zones` | yes | CRUD | Tenant-scoped |
| `devices` | yes | CRUD | Device configuration |
| `device_types` | yes | no | Shared reference data |
| `device_states` | yes | no | Gateway/device reported state |
| `device_logs` | yes | no | Append-only operational history |
| `gateways` | yes | CRUD | Gateway registry |
| `automations` | yes | CRUD | Trigger/condition/action JSONB |
| `automation_logs` | yes | no | Execution history |
| `scenes` | yes | CRUD | Scene definitions |
| `scene_devices` | yes | CRUD | Scene-to-device commands |
| `schedules` | yes | CRUD | Automation/scene schedules |
| `sensor_data` | yes | no | High-volume telemetry ingestion |
| `notifications` | yes | no | Server-created notifications |
| `integrations` | yes | CRUD | Never put provider secrets in `config` |
| `firmware_updates` | yes | no | Server/gateway controlled |
| `security_events` | yes | no | Server-created security events |
| `admin_users` | self only | no | Role changes remain service-role/backend-only |
| `user_profiles` | self/tenant | update | Creation/status changes remain backend-controlled |

## Operational endpoints

- `GET /health` — process liveness; no external dependency claim.
- `GET /ready` — checks Supabase configuration and connectivity; returns `503` until configured.

## Home and sensor model

Each `isyen_id` may own exactly one row in `homes`. This is enforced by the database unique index `homes_one_per_isyen_id_idx`, not only by the dashboard. A device belongs to that home through the tenant-scoped `(isyen_id, home_id)` relationship.

Sensor models are shared rows in `device_types` and tenant-owned installations are rows in `devices`. The catalog includes DHT11/DHT22, MQ-2 gas/smoke, PIR motion, LDR light, soil moisture, smoke, flame, BMP280, ultrasonic, relay and smart-light references. New models can be added to the shared catalog without adding a tenant table.

Example device payload:

```json
{
  "home_id": "<home-uuid>",
  "name": "Kitchen gas watch",
  "status": "provisioning",
  "config": {
    "device_type_key": "sensor_mq2_gas",
    "room_name": "Kitchen",
    "sampling_interval_seconds": 10
  },
  "metadata": { "dashboard_created": true }
}
```

Telemetry is written to `sensor_data` with a metric such as `temperature`, `humidity`, `gas`, `motion`, `smoke`, `flame`, `illuminance`, `soil_moisture`, `pressure` or `distance`. The high-volume table remains partitioned by `recorded_at`.

## Automation builder payload

The dashboard stores a rule in the existing `automations` table. The three JSONB sections are intentionally explicit so a sensor-specific rule can be represented without a new table:

```json
{
  "home_id": "<home-uuid>",
  "name": "Cool the room",
  "is_enabled": true,
  "trigger_config": {
    "type": "sensor",
    "device_id": "<sensor-uuid>",
    "metric": "temperature",
    "operator": "greater_than",
    "value": 30
  },
  "condition_config": {},
  "action_config": {
    "device_id": "<actuator-uuid>",
    "command": { "power": true }
  }
}
```

The dashboard is safe in preview mode without a logged-in token. With `NEXT_PUBLIC_API_BASE_URL` and a Supabase access token stored by the future auth flow, its add-device and create-automation forms call the authenticated API.

## Security rules

- Never put `SUPABASE_SERVICE_ROLE_KEY` in `app/`, `management/`, a browser bundle, `.env.example` with a real value, or Git history.
- The API strips protected fields (`id`, `auth_user_id`, `isyen_id`, timestamps) from request bodies and writes `isyen_id` from the resolved profile.
- Database RLS policies compare trusted JWT `app_metadata.isyen_id` with each row's `isyen_id`.
- Use pagination for all list reads and keep `limit <= 100`.
- High-volume telemetry/log writes should use a gateway ingestion worker rather than browser CRUD.
