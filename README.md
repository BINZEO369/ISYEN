# ISYEN Smart Home — পৃথক Web ও API apps

এটি একটি repository হলেও website এবং backend **দুটি পৃথক app**: তাদের আলাদা package, build/start command, root directory, deploy target এবং URL/origin। `web/` হলো Next.js + React dashboard; `api/` হলো native Node.js REST service। Browser সরাসরি Supabase Auth/REST-এ যায় না: login, registration, session refresh, dashboard ও CRUD endpoint সবই `isyen-api`-র মাধ্যমে যায়। Supabase configuration শুধু API service-এর runtime-এ থাকে। Admin এই কাজের scope-এ নেই এবং অপরিবর্তিত রাখা হয়েছে।

## Project structure

```text
web/                         # Vercel website project root
  app/                       # Next.js URL routes: /signin, /signup, /dashboard
  components/                # auth, protected dashboard route, cards, feedback
  services/                  # API origin/configuration only; no Supabase browser key
  styles/                    # responsive dashboard styles
  package.json               # web-only dependencies and scripts
  .env.example

api/                         # separate Node.js API host root
  server.js                  # HTTP service entrypoint (npm start)
  src/
    server.js                # request lifecycle, CORS, error mapping
    router.js                # endpoint dispatch
    controllers/              # auth, dashboard, gateway, node, device, sensor
    http.js                  # request/response, CORS, URL helpers
    supabase.js               # server-side Supabase Auth/REST requests
    validators.js             # IDs, pins, fields and payload validation
  test/                       # isolated Node built-in tests
  package.json
  .env.example

admin/                        # deferred; existing placeholder left alone
```

`web/` আর root-level `src/` নেই। `api/server.js`-ই API process entry point; endpoint logic আলাদা controllers/modules-এ। কোনো Supabase schema migration বা service-role key যোগ করা হয়নি।

## Website URL structure

| URL | কাজ |
| --- | --- |
| `/` | `/dashboard`-এ পাঠায়; login session না থাকলে dashboard route `/signin`-এ পাঠায় |
| `/signin` | Login page; সরাসরি open/refresh করা যায় |
| `/signup` | Registration page; সরাসরি open/refresh করা যায় |
| `/dashboard` | Protected dashboard; বৈধ session না থাকলে `/signin`-এ ফেরত পাঠায় |

Login/register screen-এর switch link-ও URL বদলায়; dashboard logout করলে `/signin`-এ যায়।

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

GitHub repository-টি Vercel-এ import করে **Root Directory = `web`** দিন; Framework Preset Next.js/auto-detect, build command `npm run build`। Production website-এর কোনো environment variable দরকার নেই: code-এর default API origin `https://isyen-api.vercel.app`। Local/staging API আলাদা হলে শুধু সে ক্ষেত্রে `NEXT_PUBLIC_API_BASE_URL` override দিন। Frontend-এ Supabase URL/key দেবেন না।

### 2. API — Vercel project root `api/`

`isyen-api` Vercel project-এ **Root Directory = `api`**, Node framework রাখুন। Vercel Project Environment Variables-এ (শুধু এই API project-এ) দিন:

| Variable            | Value                                                                           |
| ------------------- | ------------------------------------------------------------------------------- |
| `SUPABASE_URL`      | Supabase project URL                                                            |
| `SUPABASE_ANON_KEY` | Supabase publishable/anon key—service-role নয়                                   |
| `ALLOWED_ORIGINS`   | Website deployment-এর exact origin; custom domain থাকলে comma-separated origins |
| `PORT`              | Vercel নিজে দেয়; local API default `3001`                                      |

`ALLOWED_ORIGINS`-এ website-এর exact origin (`https://isyen-web.vercel.app`) থাকতে হবে। API health URL: `https://isyen-api.vercel.app/api/health`। Login/register/refresh ও dashboard request API দিয়ে হয়; server-side publishable key এবং user access token দিয়ে Supabase Auth/REST ব্যবহার হয়, ফলে Supabase RLS owner isolation বজায় থাকে।

> Supabase anon/publishable key API runtime-এ রাখা হয়; `SUPABASE_SERVICE_ROLE_KEY` কোনো app-এ যোগ করবেন না। Email confirmation চালু থাকলে Supabase Auth URL Configuration-এ `https://isyen-web.vercel.app` Site URL/redirect origin হিসেবে অনুমোদন করুন।

## API endpoints

| Method         | Endpoint                           | উদ্দেশ্য                                               |
| -------------- | ---------------------------------- | ------------------------------------------------------ |
| GET            | `/api/health`                      | API health check                                       |
| POST           | `/api/auth/register`               | Supabase Auth-এ account registration                  |
| POST           | `/api/auth/login`                  | Password login এবং session ফেরানো                     |
| POST           | `/api/auth/refresh`                | Expired access token refresh                           |
| GET / POST     | `/api/auth/session`, `/api/auth/logout` | Current user যাচাই / logout                       |
| GET            | `/api/dashboard`                   | Gateways, nodes, devices, sensors ও readings           |
| GET            | `/api/readings?type=fast\|slow`    | latest sensor reading polling                          |
| POST           | `/api/gateways`                    | লগ-ইন করা user-এর Gateway ও claim code তৈরি            |
| PATCH / DELETE | `/api/nodes/:id`                   | Sub Node approve/rename অথবা child resources-সহ delete |
| POST / DELETE  | `/api/devices`, `/api/devices/:id` | Device তৈরি/মুছুন                                      |
| PATCH          | `/api/devices/:id/state`           | Device on/off                                          |
| POST / DELETE  | `/api/sensors`, `/api/sensors/:id` | Sensor তৈরি/মুছুন                                      |

API validation-এ অনুমোদিত GPIO, sensor type, approved Sub Node ownership এবং request size পরীক্ষা হয়। Login, registration, refresh, logout ও dashboard CRUD নির্দিষ্ট API endpoints-এ যায়; browser-এ Supabase client/key নেই। Dashboard overview ১৫ সেকেন্ডে refresh হয়; sensor readings API দিয়ে fast/slow interval-এ poll হয়। Access/refresh session শুধু tab-এর `sessionStorage`-এ থাকে; browser/tab বন্ধ হলে পুনরায় login লাগতে পারে।

## Checks

```sh
cd web && npm run build
cd ../api && npm run check && npm test
```

API tests mock Supabase requests; production database-এ test write করে না।
