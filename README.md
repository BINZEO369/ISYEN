# ISYEN Smart Home — পৃথক Web ও API apps

এটি একটি repository হলেও website এবং backend **দুটি পৃথক app**: তাদের আলাদা package, build/start command, root directory, deploy target এবং URL/origin। `web/` হলো Next.js + React dashboard; `api/` হলো independently hosted native Node.js REST service। Admin এই কাজের scope-এ নেই এবং অপরিবর্তিত রাখা হয়েছে।

## Project structure

```text
web/                         # Vercel website project root
  app/                       # Next.js App Router
  components/                # auth, dashboard, cards, feedback
  services/                  # Supabase Auth client and runtime configuration
  styles/                    # responsive dashboard styles
  package.json               # web-only dependencies and scripts
  .env.example

api/                         # separate Node.js API host root
  server.js                  # HTTP service entrypoint (npm start)
  src/
    server.js                # request lifecycle, CORS, error mapping
    router.js                # endpoint dispatch
    controllers/              # dashboard, gateway, node, device, sensor
    http.js                  # request/response, CORS, URL helpers
    supabase.js               # per-user JWT Supabase REST access
    validators.js             # IDs, pins, fields and payload validation
  test/                       # isolated Node built-in tests
  package.json
  .env.example

admin/                        # deferred; existing placeholder left alone
```

`web/` আর root-level `src/` নেই। `api/server.js`-ই API process entry point; endpoint logic আলাদা controllers/modules-এ। কোনো Supabase schema migration বা service-role key যোগ করা হয়নি।

## কীভাবে local-এ চালাবেন

Node.js 20.9+ (Node 22 সুপারিশকৃত) দরকার। `.env.example` থেকে প্রতিটি app-এর নিজস্ব local env file বানান।

```sh
# Terminal 1 — API
cp api/.env.example api/.env
# api/.env-এ local CORS origin http://localhost:3000 দিন
cd api
npm install
npm start                 # http://localhost:3001
```

```sh
# Terminal 2 — website
cp web/.env.example web/.env.local
# web/.env.local-এ NEXT_PUBLIC_API_BASE_URL=http://localhost:3001 দিন
cd web
npm install
npm run dev                # http://localhost:3000
```

Local API env-তে `ALLOWED_ORIGINS=http://localhost:3000`; production API env-তে আপনার deployed website-এর exact HTTPS origin(s) দিন। API server `.env`-কে `api/` directory থেকে পড়ে। Next.js environment values build-এর সময় `web/` project root থেকে পড়ে।

## Deploy আলাদা URL-এ

### 1. Website — Vercel project root `web/`

GitHub repository-টি Vercel-এ import করে **Root Directory = `web`** দিন; Framework Preset Next.js/auto-detect, build command `npm run build`। Vercel Project Environment Variables-এ রাখুন:

| Variable                        | Value                                                                   |
| ------------------------------- | ----------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Supabase project URL                                                    |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase publishable/anon key—browser-এ ব্যবহারের জন্য public key       |
| `NEXT_PUBLIC_API_BASE_URL`      | API host-এর origin, যেমন `https://api.example.com`—শেষে `/api` দেবেন না |

Deploy করলে website URL হবে Vercel-এর website URL; Vercel-এ environment বদলালে নতুন deployment করতে হবে।

### 2. API — স্বতন্ত্র Node.js service root `api/`

API-র জন্য আলাদা Node host/service তৈরি করুন (যেমন Render/Fly.io বা আপনার Node host) এবং একই repository থেকে **Root Directory = `api`**, build/install `npm install`, start command `npm start` দিন। Host-এর environment variables:

| Variable            | Value                                                                           |
| ------------------- | ------------------------------------------------------------------------------- |
| `SUPABASE_URL`      | Supabase project URL                                                            |
| `SUPABASE_ANON_KEY` | একই Supabase publishable/anon key—service-role নয়                              |
| `ALLOWED_ORIGINS`   | Website deployment-এর exact origin; custom domain থাকলে comma-separated origins |
| `PORT`              | Host সাধারণত নিজে দেয়; না দিলে API default `3001`                              |

এরপর website Vercel-এর `NEXT_PUBLIC_API_BASE_URL`-এ এই API service origin বসিয়ে redeploy করুন। API host-এর `ALLOWED_ORIGINS`-এ Vercel/custom domain-এর website origin থাকতে হবে। API health URL: `https://api.example.com/api/health`। Website API-তে Supabase access token পাঠায়; API token যাচাই করে একই user JWT দিয়ে database request করে, ফলে Supabase RLS owner isolation বজায় থাকে।

> `NEXT_PUBLIC_*` variables browser-এ প্রকাশিত হয়। এগুলোতে শুধু Supabase URL/anon key এবং API origin দিন। `SUPABASE_SERVICE_ROLE_KEY` কোনো app-এ যোগ করবেন না।

## API endpoints

| Method         | Endpoint                           | উদ্দেশ্য                                               |
| -------------- | ---------------------------------- | ------------------------------------------------------ |
| GET            | `/api/health`                      | API health check                                       |
| GET            | `/api/dashboard`                   | Gateways, nodes, devices, sensors ও readings           |
| GET            | `/api/readings?type=fast\|slow`    | latest sensor reading polling                          |
| POST           | `/api/gateways`                    | লগ-ইন করা user-এর Gateway ও claim code তৈরি            |
| PATCH / DELETE | `/api/nodes/:id`                   | Sub Node approve/rename অথবা child resources-সহ delete |
| POST / DELETE  | `/api/devices`, `/api/devices/:id` | Device তৈরি/মুছুন                                      |
| PATCH          | `/api/devices/:id/state`           | Device on/off                                          |
| POST / DELETE  | `/api/sensors`, `/api/sensors/:id` | Sensor তৈরি/মুছুন                                      |

API validation-এ অনুমোদিত GPIO, sensor type, approved Sub Node ownership এবং request size পরীক্ষা হয়। Fast/slow reading polling, Gateway status এবং realtime dashboard refresh frontend-এ আছে। Login ও registration page Supabase Auth-এ সরাসরি sign-in/sign-up request পাঠায়; Dashboard component নিজ নিজ backend endpoint-এ সরাসরি request পাঠায়। Frontend-এ আলাদা কেন্দ্রীয় API client file নেই; API server Supabase-এর সঙ্গে যোগাযোগ করে।

## Checks

```sh
cd web && npm run build
cd ../api && npm run check && npm test
```

API tests mock Supabase requests; production database-এ test write করে না।
