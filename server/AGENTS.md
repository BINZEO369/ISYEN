# `server/` — Backend Instructions

This package owns all backend behavior and server configuration: Node.js runtime, service startup/shutdown, environment parsing, REST endpoints, WebSocket handlers, input schemas, authentication/authorization, and future data/service integrations. Current TypeScript source is under `src/`; the present endpoint `GET /health` is a liveness check only.

Use only TypeScript/JavaScript on Node.js, Fastify and the approved ISYEN stack. Do not introduce another programming language, framework, runtime, database migration language, or MQTT broker/client. JSON/YAML/Markdown and the `Dockerfile` are configuration/documentation formats only. Keep dependencies in this package manifest and the single root pnpm lockfile; do not add a nested workspace or package lockfile.

As API implementation grows, organize it under `src/` with focused modules such as `routes/`, `schemas/`, `plugins/`, `services/`, `repositories/`, and `integrations/`. Keep route registration centralized and make API/WebSocket contracts clear for `app/` and `management/`; do not implement UI or page components in this package.

The server is the sole authority for request validation and authorization. Never accept browser-supplied roles or permissions as proof. Validate every REST/WebSocket input, use least privilege, redact credentials from logs, and keep private values server-only. Browser applications must not contain server secrets.

Supabase is not connected. `src/integrations/supabase.ts` is a placeholder, not a live adapter. Do not initialize a client, apply schema changes, add SQL migrations, change Auth/Storage policies, or write database data until the user explicitly approves database work and identifies the intended project. MQTT is expressly excluded.

The current service is intentionally minimal. Keep `pnpm --filter @isyen/server build`, `typecheck`, `lint`, and `test` passing. Add tests for every implemented API/auth behavior; do not claim the liveness test covers unimplemented product features.
