# `@isyen/server` — ISYEN backend

Node.js 22, TypeScript ও Fastify-ভিত্তিক backend। এটি Supabase PostgreSQL schema-এর জন্য authenticated, tenant-scoped REST API প্রদান করে। Account/Auth identity Supabase Auth থেকে আসে; `user_profiles.isyen_id` tenant root হিসেবে ব্যবহৃত হয়। MQTT এই scope-এর বাইরে।

## চালানো

Monorepo root থেকে:

```sh
pnpm install
cp server/.env.example server/.env
# server/.env-এ Supabase anon/publishable key এবং server-only service-role key বসান
pnpm --filter @isyen/server dev
```

Backend default `http://localhost:4000`-এ চলে। `GET /health` process liveness এবং `GET /ready` Supabase readiness যাচাই করে। Authenticated database routes-এর জন্য `Authorization: Bearer <Supabase access token>` পাঠাতে হবে।

## API

সব resource-এর generic endpoint:

```text
GET    /api/v1/:resource
GET    /api/v1/:resource/:id
POST   /api/v1/:resource
PATCH  /api/v1/:resource/:id
DELETE /api/v1/:resource/:id
```

Table-wise read/write permissions, environment variables, pagination, security এবং operational guidance [API.md](API.md)-এ আছে।

## Environment

Required production values:

```text
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
CORS_ORIGIN
```

`SUPABASE_SERVICE_ROLE_KEY` শুধু server runtime-এ থাকবে; কখনো frontend, mobile bundle, GitHub বা public logs-এ যাবে না।

## যাচাই

```sh
pnpm --filter @isyen/server typecheck
pnpm --filter @isyen/server lint
pnpm --filter @isyen/server test
pnpm --filter @isyen/server build
```
