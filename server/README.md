# `@isyen/server` — backend scaffold

Node.js 22, TypeScript ও Fastify-ভিত্তিক ন্যূনতম backend package। এই পর্যায়ে শুধু framework setup, runtime configuration এবং liveness endpoint আছে; কোনো product API, business logic, Supabase connection, database schema বা migration নেই। MQTT সম্পূর্ণ বাদ।

## চালানো

Monorepo root থেকে:

```sh
pnpm install
cp server/.env.example server/.env
pnpm --filter @isyen/server dev
```

Backend default `http://localhost:4000`-এ চলে। `GET /health` শুধু process liveness জানায়; external dependency-র স্বাস্থ্য দাবি করে না। TypeScript entrypoint `src/index.ts`; build output `dist/`-এ যায়।

## স্ক্রিপ্ট

`pnpm --filter @isyen/server dev`, `build`, `start`, `lint`, `typecheck` এবং `test`। Root থেকে সব তিনটি package একসাথে পরীক্ষা করতে `pnpm check` ব্যবহার করুন।

## ভবিষ্যৎ সংযোগের স্থান

`src/routes/README.md`-এ REST/WebSocket route-এর ভবিষ্যৎ অবস্থান চিহ্নিত; `src/integrations/supabase.ts` placeholder মাত্র, কোনো client initialize বা connection করে না। Supabase JavaScript SDK ও Fastify security/WebSocket dependencies package configuration-এ রাখা হয়েছে, কিন্তু plugin/client এখনো register বা চালু নয়। বাস্তব feature ও credential পরে যোগ হবে।