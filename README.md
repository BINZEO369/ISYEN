# ISYEN — repository scaffold

এটি নতুন ISYEN প্রোগ্রামের coding শুরু করার জন্য প্রস্তুত monorepo scaffold। এখনকার কাজ শুধু folder structure, language/framework setup, package configuration, starter entrypoint ও documentation—কোনো পূর্ণ user feature, admin workflow বা business logic নয়। MQTT অন্তর্ভুক্ত নয়।

## মূল folder

```text
ISYEN/
├── app/          # User application: Next.js + React + TypeScript + Tailwind
├── server/       # API endpoints and Node.js + TypeScript server configuration
├── management/   # Admin pages and interface: Next.js + React + TypeScript + Tailwind
└── docs/         # Architecture, contribution, security and development report
```

**মোট চারটি tracked top-level folder:** `app/`, `server/`, `management/` এবং documentation-only `docs/`। প্রথম তিনটি code package; `docs/`-এ long-form documentation রাখা হয়। `package.json`, `pnpm-workspace.yaml`, lockfile, `.gitignore`, `.nvmrc`, root `README.md` ও `AGENTS.md`-এর মতো standard tool-discovered file root-এ রাখতে হয়—অন্য folder-এ সরালে package manager, Git বা coding-agent tooling ভাঙতে পারে। HTML5/CSS3 Next.js starter page-এ, JavaScript TypeScript-সহ, আর REST/WebSocket/Supabase-এর dependency/configuration ভবিষ্যৎ implementation-এর জন্য রাখা হচ্ছে—এগুলো এখনো live service connection বা product feature নয়।

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

## Agent ও developer নির্দেশনা

পরবর্তী coding শুরু করার আগে root [AGENTS.md](AGENTS.md) এবং সংশ্লিষ্ট package-এর `AGENTS.md` পড়ুন। English ownership map ও approved language boundaries [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)-এ আছে।

## Supabase ও remote repository

Supabase এখনো এই repository-তে connect বা provision করা হয়নি। `.env.example`-এর value placeholder মাত্র; কোনো database/schema/auth/storage পরিবর্তন করা হয়নি। সঠিক ISYEN project পরে যুক্ত করে সিদ্ধান্ত নেওয়া যাবে।

Repository: [github.com/BINZEO369/ISYEN](https://github.com/BINZEO369/ISYEN), `main` branch। Setup-এর সীমা ও যাচাইকৃত ফলাফল [Development Report](docs/DEVELOPMENT_REPORT.md)-এ আছে।
