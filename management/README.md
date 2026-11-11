# ISYEN ম্যানেজমেন্ট — স্ক্যাফোল্ড

`@isyen/management` হলো ISYEN pnpm monorepo-র একটি স্বতন্ত্র Next.js অ্যাপ প্যাকেজ। এটি Node.js 22, Next.js 15, React 19, TypeScript এবং Tailwind CSS v3-এর ভিত্তি কাঠামো।

## বর্তমান পরিধি

এখানে কেবল responsive placeholder পৃষ্ঠা ও অ্যাপ কনফিগারেশন আছে। কোনো dashboard, admin workflow, login/auth flow, Supabase connection, API request বা demo data নেই। `.env.example`-এর মানগুলো শুধু নমুনা; কোনো Supabase project বা backend সংযুক্ত নয়।

## চালানো

Monorepo-র workspace root থেকে dependencies ইনস্টল করুন, তারপর এই প্যাকেজটি filter করে চালান:

```sh
pnpm install
pnpm --filter @isyen/management dev
```

অথবা প্যাকেজ ডিরেক্টরিতে `pnpm dev` চালান। স্থানীয় environment-এর জন্য `.env.example` কপি করে `.env.local` তৈরি করতে পারেন; বাস্তব public config না থাকলে সেটি ফাঁকা রাখুন। কোনো secret বা service-role key frontend env-এ যোগ করবেন না।

## স্ক্রিপ্ট

```sh
pnpm dev        # development server
pnpm build      # production build
pnpm start      # production server
pnpm lint       # ESLint
pnpm typecheck  # TypeScript যাচাই
pnpm test       # Vitest (এখনো কোনো feature test নেই)
```

`test` স্ক্রিপ্টে বর্তমানে test file না থাকাও গ্রহণযোগ্য, যাতে খালি scaffold-এ কমান্ডটি সফল থাকে।

## কাঠামো

```text
management/
├── app/                  # Next.js App Router placeholder ও stylesheet
├── public/               # স্থির route manifest
├── .env.example          # frontend config-এর নমুনা নাম
├── next.config.ts
├── package.json
├── postcss.config.mjs
├── tailwind.config.ts
└── tsconfig.json
```

Monorepo-র workspace manifest root-এ থাকে; এই প্যাকেজে আলাদা `pnpm-workspace.yaml` রাখা হয়নি।
