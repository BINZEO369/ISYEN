# Security Baseline

এটি configuration-only scaffold; এতে production credential, database connection বা live deployment নেই। `.env.example`-এ placeholder রাখুন, বাস্তব value শুধু ignored local `.env*` বা secret manager-এ দিন। `.env`, service-role key, token বা password কখনো Git-এ commit করবেন না।

Supabase connection পরে যোগ করার সময় browser-এ কেবল publishable/anon key ব্যবহার করতে হবে; service-role key server-only থাকবে। Auth, authorization, CORS, rate limiting, input validation, WebSocket authentication এবং Storage policies বাস্তব feature বানানোর সময় server-side-এ configure ও review করতে হবে।

কোনো migration এই scaffold task-এ প্রয়োগ করা হয়নি। MQTT scope-এর বাইরে।