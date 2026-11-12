# ISYEN — Smart Home Dashboard and API

ISYEN is a Next.js user dashboard, a Fastify REST API, and a separate management app. The dashboard supports tenant-scoped homes/devices, raw ESP32-S3 GPIO sensors, and configuration for DHT11/DHT22 and BMP180/BMP280/BMP388/BMP390. MQTT is not used.

**Sensor hardware note:** DHT/BMP model, wiring, sampling interval, I²C address and temperature unit can be saved in the shared catalog and tenant device configuration. Live readings require the matching ESP32 firmware drivers and telemetry update; until then the dashboard marks these sensors as firmware-waiting and does not invent readings. Raw GPIO telemetry is separate.

## মূল folder

```text
ISYEN/
├── app/          # User application: Next.js + React + TypeScript + Tailwind
├── server/       # API endpoints and Node.js + TypeScript server configuration
├── management/   # Admin pages and interface: Next.js + React + TypeScript + Tailwind
└── docs/         # Architecture, contribution, security and development report
```

**মোট চারটি tracked top-level folder:** `app/`, `server/`, `management/` এবং documentation-only `docs/`। প্রথম তিনটি code package; `docs/`-এ long-form documentation রাখা হয়। `package.json`, `pnpm-workspace.yaml`, lockfile, `.gitignore`, `.nvmrc`, root `README.md` ও `AGENTS.md`-এর মতো standard tool-discovered file root-এ রাখতে হয়।

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

The configured Supabase project is `ISYEN HOME`. Runtime credentials remain placeholders in `.env.example`; never commit real credentials. Catalog migrations are kept under `server/database/`.

Repository: [github.com/BINZEO369/ISYEN](https://github.com/BINZEO369/ISYEN), `main` branch। Setup-এর সীমা ও যাচাইকৃত ফলাফল [Development Report](docs/DEVELOPMENT_REPORT.md)-এ আছে।
