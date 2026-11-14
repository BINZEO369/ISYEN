# ISYEN Home Automation

ISYEN Home হলো Supabase Auth-ভিত্তিক home automation dashboard। Frontend `web/`-এ, Node.js API `api/`-তে এবং local HTTP/static server `server.js`-এ রাখা হয়েছে। `admin/` ফোল্ডারটি এই পরিবর্তনের বাইরে রাখা হয়েছে।

## বৈশিষ্ট্য

- ইমেইল/পাসওয়ার্ডে account registration, login ও logout
- Gateway তৈরি এবং ESP32 setup portal-এর জন্য unique claim code
- নতুন sub-node অনুমোদন, নাম পরিবর্তন ও মুছে ফেলা
- Light/device যোগ, চালু/বন্ধ ও মুছে ফেলা
- DHT11/DHT22, MQ2/MQ135, PIR এবং REED sensor ও readings
- PIR/REED কেবল অনুমোদিত Sub Node-এ; HIGH/LOW trigger নির্বাচন
- Live refresh, দ্রুত motion/door polling, responsive mobile layout

## স্থানীয়ভাবে চালানো

Node.js 18+ লাগবে।

```sh
cp .env.example .env
# .env-এ SUPABASE_ANON_KEY-এ Supabase publishable/anon key দিন
npm start
```

`http://localhost:3000` খুলুন। `.env` commit করবেন না। `SUPABASE_SERVICE_ROLE_KEY` এই অ্যাপের প্রয়োজন নেই: server কখনও service-role privileges ব্যবহার করে না। API user-এর Supabase access token সামনে দিয়ে দেয়, ফলে database-এর RLS policies ownership enforce করে।

## API

Authenticated endpoint-এ `Authorization: Bearer <Supabase access token>` এবং `apikey: <publishable/anon key>` পাঠাতে হয়। API token Supabase Auth দিয়ে যাচাই করে, এবং database query-তেও একই user JWT ব্যবহার করে। কোনো service-role key ব্যবহার হয় না।

| Method         | Endpoint                            | কাজ                                                         |
| -------------- | ----------------------------------- | ----------------------------------------------------------- |
| GET            | `/api/health`                       | health check                                                |
| GET            | `/api/config`                       | browser-safe config: Supabase URL/key ও public API base URL |
| GET            | `/api/dashboard`                    | gateways, nodes, devices, sensors ও সর্বশেষ readings        |
| GET            | `/api/readings?type=fast\|slow`     | সর্বশেষ sensor readings                                     |
| POST           | `/api/gateways`                     | gateway তৈরি ও server-generated claim code                  |
| PATCH / DELETE | `/api/nodes/:id`                    | node approve/rename বা delete                               |
| POST / DELETE  | `/api/devices` · `/api/devices/:id` | device যোগ বা delete                                        |
| PATCH          | `/api/devices/:id/state`            | device on/off                                               |
| POST / DELETE  | `/api/sensors` · `/api/sensors/:id` | sensor যোগ বা delete                                        |

API-তে input validation, অনুমোদিত GPIO/sensor type checks, request-size limit এবং CORS allowlist আছে। `SUPABASE_ANON_KEY` বা publishable key public/client key; কোনো secret key browser-এ পাঠানো হয় না।

## আলাদা API host-এ deploy

### 1. Frontend (Vercel)

Repository-টি Vercel-এ import করুন; `vercel.json` root `/`-কে `web/index.html`-এ এবং `/assets/*`-কে frontend assets-এ route করে। Vercel Project Settings → Environment Variables-এ দিন:

- `SUPABASE_URL` = Supabase project URL
- `SUPABASE_ANON_KEY` = Supabase publishable/anon key (এটি public browser key; service-role key নয়)
- `PUBLIC_API_BASE_URL` = আলাদা Node API host-এর origin, যেমন `https://api.example.com` (শেষে slash ছাড়া)

`/api/config` কেবল browser-এ প্রকাশযোগ্য runtime config ফেরত দেয়; কোনো server secret নয়। Vercel project-এ environment variable update করলে redeploy/rebuild করুন.

### 2. Node.js API host

`server.js` এবং `api/`-সহ একই repository-টি Render/Railway বা Node.js host-এ deploy করে `npm start` চালান। API host-এ দিন:

- `SUPABASE_URL` = Supabase project URL
- `SUPABASE_ANON_KEY` = একই publishable/anon key
- `ALLOWED_ORIGINS` = Vercel ও custom frontend domain-গুলো comma-separated exact origin হিসেবে, যেমন `https://your-app.vercel.app,https://home.example.com`
- host-provided `PORT` (সাধারণত নিজে থেকেই সেট হয়)

CORS wildcard নয়—প্রতিটি frontend origin স্পষ্ট করে allowlist করুন। `/api/*` route Node server-এ পাঠান। HTTPS বাধ্যতামূলক রাখুন।

### একই host-এ Vercel API Functions

আলাদা API host না চাইলে Vercel একই repository-র `api/index.js` function deploy করতে পারে। `PUBLIC_API_BASE_URL` ফাঁকা রাখুন; frontend একই origin-এ `/api/*` ডাকবে।

## Database

Supabase `public` schema-র `gateways`, `nodes`, `devices`, `device_states`, `sensors` এবং `sensor_readings` টেবিল এবং বিদ্যমান RLS ব্যবহার হয়। Device insert-এ state তৈরি এবং gateway claim-code timestamp-এর DB trigger ইতিমধ্যে আছে। এই implementation Supabase schema বা production data পরিবর্তন করে না। `admin/index.js` ও admin UI স্পর্শ করা হয়নি।
