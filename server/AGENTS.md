# `server/` — Backend Instructions

This package owns backend behavior and configuration: Node.js runtime, service startup/shutdown, environment parsing, REST endpoints, WebSocket handlers, input schemas, authentication/authorization, and integrations. The current service provides unauthenticated `GET /`, `/health`, `/healthz` liveness routes, `GET /ready` Supabase connectivity, and authenticated `/api/v1/:resource` routes for the allowlisted database schema.

Use only TypeScript/JavaScript on Node.js, Fastify and the approved ISYEN stack. Do not introduce another language, runtime, framework, database migration language, or MQTT broker/client. Keep dependencies in this package manifest and the single root pnpm lockfile; do not add a nested workspace or package lockfile.

The `ISYEN HOME` Supabase project is available for schema inspection. For application CRUD, use the caller's verified Supabase JWT, resolve the caller's profile through its self-read RLS policy, and keep RLS enabled. Never use the service-role key for ordinary REST reads/writes. Do not apply migrations, alter Auth/Storage settings, or write production data unless the user explicitly requests that database change; do not add SQL migration files in this package.

As API implementation grows, organize it under `src/` with focused modules such as `routes/`, `schemas/`, `plugins/`, `services/`, `repositories/`, and `integrations/`. Keep route registration centralized and make API/WebSocket contracts clear for `app/` and `management/`; do not implement UI or page components in this package.

The server is the sole authority for request validation and authorization. Never accept browser-supplied roles or permissions as proof. Validate every REST/WebSocket input, use least privilege, redact credentials from logs and responses, and keep private values server-only. Browser applications must not contain server secrets.

Keep `pnpm --filter @isyen/server build`, `typecheck`, `lint`, and `test` passing. Add regression tests for implemented API/auth behavior; a liveness test alone does not cover product endpoints.
