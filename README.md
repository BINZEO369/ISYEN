# ISYEN — repository scaffold

এটি নতুন ISYEN প্রোগ্রামের coding শুরু করার জন্য প্রস্তুত monorepo scaffold। এখনকার কাজ শুধু folder structure, language/framework setup, package configuration, starter entrypoint ও documentation—কোনো পূর্ণ user feature, admin workflow বা business logic নয়। MQTT অন্তর্ভুক্ত নয়।

## মূল folder

```text
ISYEN/
├── app/          # User application: Next.js + React + TypeScript + Tailwind
├── management/   # Management panel: Next.js + React + TypeScript + Tailwind
└── server/       # Node.js + TypeScript service scaffold
```

**শুধু এই তিনটিই মূল code folder।** Root-level `package.json`, `pnpm-workspace.yaml` এবং toolchain files তিনটি package-কে এক জায়গা থেকে configure ও চালায়। HTML5/CSS3 Next.js starter page-এ, JavaScript TypeScript-সহ, আর REST/WebSocket/Supabase-এর dependency/configuration ভবিষ্যৎ implementation-এর জন্য রাখা হচ্ছে—এগুলো এখনো live service connection বা product feature নয়।

## চালানো

প্রয়োজন: Node.js 22+ এবং pnpm 11+। Root থেকে:

```sh
pnpm install
cp app/.env.example app/.env.local
cp management/.env.example management/.env.local
cp server/.env.example server/.env
pnpm dev
```

আলাদা package চালাতে `pnpm dev:app`, `pnpm dev:management`, `pnpm dev:server`; code checks-এর জন্য `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` বা `pnpm check`। Example environment files-এ placeholder থাকবে; local credential `.env*`-এ রাখুন এবং commit করবেন না।

## Supabase ও remote repository

Supabase এখনো এই repository-তে connect বা provision করা হয়নি। `.env.example`-এর value placeholder মাত্র; কোনো database/schema/auth/storage পরিবর্তন করা হয়নি। সঠিক ISYEN project পরে যুক্ত করে সিদ্ধান্ত নেওয়া যাবে।

এই task environment-এ কোনো ISYEN checkout বা Git remote পাওয়া যায়নি। তাই নতুন workspace `/home/ubuntu/ISYEN`-এ তৈরি হচ্ছে, remote-এ push/sync নয়।

Setup-এর সীমা ও যাচাইকৃত ফলাফল [Development Report](DEVELOPMENT_REPORT.md)-এ আছে।