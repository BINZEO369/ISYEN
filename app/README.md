# `@isyen/app` — ISYEN user application

বাংলা-ভিত্তিক Next.js 15/React 19 user app। আলাদা `/sign-in` ও `/register` পেজ, Supabase Auth password login, user profile onboarding এবং `/dashboard`-এ নিজের database profile read অন্তর্ভুক্ত। Email/OTP verification ধাপ এই MVP-তে নেই।

## চালানো

Monorepo root থেকে:

```sh
pnpm install --frozen-lockfile
pnpm --filter @isyen/app dev
```

অ্যাপটি `http://localhost:3000`-এ চলে। Registration/profile API proxy-এর জন্য server local-এ `http://127.0.0.1:4000`-এ চলতে হবে; চাইলে `ISYEN_API_BASE_URL` দিয়ে override করুন।

## Environment variables

`app/.env.example` দেখে local app config দিন। Vercel `isyen-app` production project-এ প্রয়োজনীয় variables:

```text
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<browser-safe sb_publishable key>
ISYEN_API_BASE_URL=https://isyen-api.vercel.app
```

শুধু Supabase URL ও publishable key browser bundle-এ যায়। `ISYEN_API_BASE_URL` server-side Next route handler ব্যবহার করে। `SUPABASE_SERVICE_ROLE_KEY` কোনো অবস্থাতেই এই package-এ যোগ করবেন না; সেটি শুধু `isyen-api` backend runtime-এ থাকবে।

## Registration data

Form-এ বর্তমান `user_profiles` schema-র সব ব্যবহারকারী-সম্পাদনাযোগ্য columns বিভাগভিত্তিক আছে: personal info, address/coordinates, locale/preferences এবং six notification flags. `default_home_id`, `default_room_id` ও `preferred_device_view` সক্রিয় schema-তে নেই, তাই form/API-তেও নেই. `email` Auth identity-এর সঙ্গে মেলে. `id` Postgres default, `auth_user_id` Supabase Auth, `isyen_id` trusted backend তৈরি করে. `profile_status`/`profile_completion` backend নির্ধারণ করে; creation/update timestamps database-managed. নতুন account confirmed হিসেবে তৈরি হয় বলে আলাদা verification ধাপ লাগে না.

Form browser থেকে service-role operation করে না: `/api/auth/register` server-side proxy হয়ে `isyen-api`-র `POST /auth/register`-এ যায়। Sign-in Supabase Auth browser SDK-এ হয়; `/api/profile` একই-origin server proxy দিয়ে JWT-সহ self-only `user_profiles` resource-টি load করে.

## Checks

```sh
pnpm --filter @isyen/app lint
pnpm --filter @isyen/app typecheck
pnpm --filter @isyen/app build
pnpm check
```
