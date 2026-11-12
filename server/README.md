# `@isyen/server` — ISYEN backend

Node.js 22, TypeScript ও Fastify-ভিত্তিক backend। এটি `ISYEN HOME` Supabase schema-এর জন্য authenticated, tenant-scoped REST API প্রদান করে। Account/Auth identity Supabase Auth থেকে আসে; `user_profiles.isyen_id` tenant root হিসেবে ব্যবহৃত হয়। MQTT এই scope-এর বাইরে।

## চালানো

Monorepo root থেকে:

```sh
pnpm install
cp server/.env.example server/.env
# server/.env-এ SUPABASE_URL এবং Supabase publishable/anon key বসান
pnpm --filter @isyen/server dev
```

Backend default `http://localhost:4000`-এ চলে। `/`, `/health` এবং `/healthz`—সবগুলো HTTP 200 liveness response দেয়। `GET /ready` Supabase Auth endpoint connectivity যাচাই করে; Supabase settings অনুপস্থিত বা unreachable হলে 503 দেয়। `POST /auth/register` no-email-verification signup সম্পন্ন করে; service-role key শুধু server runtime-এ লাগবে। Database table permissions প্রতিটি authenticated request-এ RLS/grants দিয়ে যাচাই হয়। Authenticated database routes-এর জন্য `Authorization: Bearer <Supabase access token>` পাঠাতে হবে।

## API

সব schema resource-এর generic endpoint:

```text
GET    /api/v1/:resource
GET    /api/v1/:resource/:id
POST   /api/v1/:resource
PATCH  /api/v1/:resource/:id
DELETE /api/v1/:resource/:id
```

Account registration এবং resource-specific read/write permissions, supported filters, error behavior ও security rules [API.md](API.md)-এ আছে। Tenant queries caller JWT এবং RLS-সহ চলে; service-role key কেবল dedicated registration/profile creation path ব্যবহার করে।

## Environment

Authenticated API/readiness-এর জন্য:

```text
SUPABASE_URL
SUPABASE_ANON_KEY
CORS_ORIGIN  # production-এ explicit frontend origins
```

`SUPABASE_SERVICE_ROLE_KEY` registration-এ server-side Auth user/profile creation-এর জন্য প্রয়োজন। কোনো service-role value frontend, mobile bundle, GitHub বা logs-এ রাখা যাবে না.

## যাচাই

```sh
pnpm --filter @isyen/server typecheck
pnpm --filter @isyen/server lint
pnpm --filter @isyen/server test
pnpm --filter @isyen/server build
```
