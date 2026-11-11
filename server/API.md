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

## Security rules

- Never put `SUPABASE_SERVICE_ROLE_KEY` in `app/`, `management/`, a browser bundle, `.env.example` with a real value, or Git history.
- The API strips protected fields (`id`, `auth_user_id`, `isyen_id`, timestamps) from request bodies and writes `isyen_id` from the resolved profile.
- Database RLS policies compare trusted JWT `app_metadata.isyen_id` with each row's `isyen_id`.
- Use pagination for all list reads and keep `limit <= 100`.
- High-volume telemetry/log writes should use a gateway ingestion worker rather than browser CRUD.
