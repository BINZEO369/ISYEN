"use strict";
const http = require("node:http");
const handle = require("./src/server");
require("./src/load-env").loadEnv();
for (const name of ["SUPABASE_URL", "SUPABASE_ANON_KEY", "ALLOWED_ORIGINS"]) {
  if (!process.env[name]) {
    console.error(`Missing required environment variable: ${name}`);
    process.exit(1);
  }
}
const port = Number(process.env.PORT || 3001);
http
  .createServer((req, res) => {
    handle(req, res);
  })
  .listen(port, "0.0.0.0", () => console.log(`ISYEN API listening on ${port}`));
