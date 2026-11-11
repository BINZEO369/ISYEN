# Server routes

`database.ts` fixed resource allowlist-এর মাধ্যমে Supabase tables-এর tenant-scoped REST endpoints register করে। `resources.ts` table permissions ও protected fields সংজ্ঞায়িত করে।

নতুন route যোগ করার আগে:

1. Resource allowlist-এ table যোগ করুন।
2. Service-only/write policy নির্ধারণ করুন।
3. RLS এবং server authorization দুটোই review করুন।
4. `server/API.md`-এর endpoint matrix আপডেট করুন।
5. Authenticated এবং cross-tenant access test যোগ করুন।
