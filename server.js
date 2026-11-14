"use strict";

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const apiHandler = require("./api");

function loadLocalEnv() {
  try {
    const contents = fs.readFileSync(path.join(__dirname, ".env"), "utf8");
    for (const line of contents.split(/\r?\n/)) {
      const match = line.match(
        /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/,
      );
      if (!match || process.env[match[1]] !== undefined) continue;
      let value = match[2];
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      } else {
        value = value.replace(/\s+#.*$/, "").trim();
      }
      process.env[match[1]] = value;
    }
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

loadLocalEnv();

const server = http.createServer((req, res) => {
  if (req.url === "/api" || req.url.startsWith("/api/")) {
    return apiHandler(req, res);
  }
  res.writeHead(404, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify({ error: "API endpoint পাওয়া যায়নি।" }));
});

const port = Number(process.env.PORT || 3001);
server.listen(port, "0.0.0.0", () => {
  console.log(`ISYEN Node API listening on port ${port}`);
});
