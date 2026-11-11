# ISYEN অ্যাপ স্ক্যাফোল্ড

এটি মনোরেপোর `@isyen/app` প্যাকেজের প্রাথমিক Next.js অ্যাপ। বর্তমানে শুধু একটি বাংলা placeholder পৃষ্ঠা আছে; কোনো ড্যাশবোর্ড, স্মার্ট-হোম API কল, Supabase সংযোগ, sign-in flow বা device control বাস্তবায়িত নয়।

## প্রয়োজনীয়তা

- Node.js 22.x
- pnpm 11.25.0 (মনোরেপোর নির্ধারিত workspace থেকে চালান)

## চালানো

মনোরেপোর root থেকে:

```bash
pnpm install
pnpm --filter @isyen/app dev
```

অ্যাপটি সাধারণত `http://localhost:3000`-এ চালু হবে। প্যাকেজের অন্যান্য script:

```bash
pnpm --filter @isyen/app build
pnpm --filter @isyen/app start
pnpm --filter @isyen/app lint
pnpm --filter @isyen/app typecheck
pnpm --filter @isyen/app test
```

## পরিবেশ কনফিগারেশন

`app/.env.example`-এর নমুনা দেখে `app/.env.local` তৈরি করা যায়। বর্তমানে পরিবেশ ভেরিয়েবলগুলো placeholder মাত্র—অ্যাপ সেগুলো পড়ে না এবং কোনো Supabase project বা API-তে সংযোগ করে না। পরবর্তী বাস্তবায়নে শুধু browser-safe `NEXT_PUBLIC_` মান ব্যবহার করতে হবে; কোনো service-role key বা গোপন server key client bundle-এ যোগ করা যাবে না।

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
NEXT_PUBLIC_API_BASE_URL=https://your-smart-home-api.example.com
```

## প্রযুক্তি ও সীমা

Next.js 15, React 19, TypeScript, Tailwind CSS 3 এবং Supabase browser SDK package dependency হিসেবে প্রস্তুত। এ পর্যায়ে এগুলোর ওপর পণ্য-লজিক তৈরি করা হয়নি। কোনো live service credential অন্তর্ভুক্ত নেই।
