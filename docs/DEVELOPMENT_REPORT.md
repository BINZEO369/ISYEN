# ISYEN Repository Development Report

**যাচাইয়ের তারিখ:** ১১ নভেম্বর ২০২৬  
**Status:** নতুন, code-ready repository scaffold প্রস্তুত; product feature implementation scope-এর বাইরে।

> **Historical note:** The scaffold-only description below predates the user dashboard, backend APIs, and connected ISYEN HOME database. Current continuation status (12 November 2026): DHT11/DHT22 and BMP180/BMP280/BMP388/BMP390 configuration, tenant-scoped multi-metric ingestion, per-metric latest queries, and dashboard realtime rendering are implemented; catalog and telemetry migrations have been applied to the connected Supabase project. Both existing Vercel projects were deployed from GitHub commit `175706d` and reached READY: `isyen-api.vercel.app` and `isyen-app.vercel.app`. Dashboard, API health/readiness, and protocol endpoint authentication smoke tests passed. No firmware files are changed, so physical sensor acquisition still requires firmware drivers to sample and POST readings. At verification time Supabase had zero configured DHT/BMP device rows; therefore, no real sensor measurements are being collected until a device is configured and firmware sends readings.

## লক্ষ্য ও folder structure

এই deliverable নতুন ISYEN প্রোগ্রামে coding শুরু করার উপযোগী করে repository, programming language/framework configuration, package scripts এবং starter entrypoint সাজায়। তিনটি primary code folder আলাদা; চতুর্থ tracked top-level folder `docs/` long-form documentation-এর জন্য:

```text
ISYEN/
├── app/          # Next.js + React user-application scaffold
├── server/       # Node.js + TypeScript + Fastify backend scaffold
├── management/   # Next.js + React admin/management scaffold
└── docs/         # Architecture, contribution, security and development report
```

Root-level `package.json`, `pnpm-workspace.yaml`, `.nvmrc`, `.gitignore`, `.editorconfig` এবং pnpm lockfile workspace/toolchain পরিচালনা করে; tooling-এর জন্য এগুলো root-এ রাখা হয়েছে। `docs/`-এ long-form architecture, contribution, security এবং development report রাখা হয়েছে। App ও Management-এ Next.js 15, React 19, TypeScript, Tailwind CSS v3, HTML/CSS starter এবং public environment examples আছে। Backend-এ Node.js 22, TypeScript, Fastify, REST/WebSocket/Supabase-সংশ্লিষ্ট package configuration এবং minimal liveness endpoint আছে। JavaScript configuration files-ও অন্তর্ভুক্ত। Development port: App 3000, Management 3001, Server 4000।

প্রতিটি UI-তে কেবল বাংলা placeholder starter page আছে; কোনো dashboard, device-control feature, admin workflow বা business logic নেই। Backend-এ শুধু `GET /health` liveness endpoint; future REST, WebSocket ও Supabase integration-এর স্থান/documentation আছে, কিন্তু live connection নেই। MQTT সম্পূর্ণ বাদ। English future-agent ownership rules `AGENTS.md` এবং architecture map `docs/ARCHITECTURE.md`-এ রাখা হয়েছে; package-ভিত্তিক নির্দেশনা সংশ্লিষ্ট folder-এর `AGENTS.md`-এ আছে।

## ইনস্টল ও যাচাই

Node.js `v22.23.4` এবং pnpm `11.25.0` দিয়ে যাচাই করা হয়েছে। Root থেকে `pnpm install --frozen-lockfile` সফল; সব তিনটি package workspace-এ resolve হয়েছে। pnpm dependency postinstall allowlist-এ শুধু প্রয়োজনীয় `esbuild` ও `sharp` রাখা হয়েছে। প্রাথমিক install output-এ কিছু deprecated ESLint/transitive package warning ছিল; ইনস্টল ব্যর্থ হয়নি।

`pnpm check` সফল হয়েছে। এতে তিন package-এর lint ও TypeScript typecheck পাস করেছে, production build পাস করেছে (দুটি Next.js app এবং TypeScript backend), server-এর ১টি health test পাস করেছে। App ও Management-এ এখনো কোনো feature/test নেই বলে তাদের test command empty-suite সফল করে; এটিকে feature coverage হিসেবে ধরা যাবে না।

README-র নির্দেশ অনুযায়ী placeholder `.env.example`-গুলি local ignored env file-এ কপি করার পর root `pnpm dev` দিয়ে তিনটি service একসঙ্গে চালু হয়েছে। App `http://127.0.0.1:3000`, Management `http://127.0.0.1:3001` এবং Server `http://127.0.0.1:4000/health`—তিনটিতেই HTTP 200 smoke test পাওয়া গেছে। কোনো local credential ব্যবহার করা হয়নি। Dockerfile root workspace context-এর জন্য প্রস্তুত, তবে এই পরিবেশে Docker executable নেই, তাই container image build যাচাই করা হয়নি।

## GitHub

Local repository `https://github.com/BINZEO369/ISYEN` remote-এর সঙ্গে সংযুক্ত। Initial scaffold commit `37aa68c` public `main` branch-এ push হয়েছে। Local environment file, secret বা build output commit করা হয়নি।

Agent instructions ও architecture documents English-এ রাখা হয়েছে, যাতে ভবিষ্যৎ coding agent-রা package ownership, approved stack এবং security boundaries পরিষ্কারভাবে অনুসরণ করতে পারে।

## ইচ্ছাকৃতভাবে deferred

Supabase project এই repository-তে সংযুক্ত নয়। Environment example-এ placeholder ছাড়া credential নেই; কোনো database, schema, migration, Auth setting বা Storage policy-তে পরিবর্তন হয়নি। উপলভ্য Supabase account-এর একমাত্র দৃশ্যমান project ISYEN হিসেবে চিহ্নিত নয় এবং তাতে unrelated বিদ্যমান data আছে, তাই সেটিকে স্পর্শ করা হয়নি।

## চালানোর নির্দেশনা

Root README-তে install ও dev কমান্ড আছে। দ্রুত শুরু: `pnpm install`, তারপর প্রতিটি `.env.example` কপি করে `pnpm dev`; আলাদাভাবে চালাতে `pnpm dev:app`, `pnpm dev:management`, `pnpm dev:server`। বাস্তব Supabase ও API credential পাওয়ার পরেই সংশ্লিষ্ট integration configure করা উচিত।
