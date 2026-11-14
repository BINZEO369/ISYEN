"use strict";

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const apiHandler = require("./api");

const root = path.join(__dirname, "web");
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

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
};

function serveFile(req, res) {
  const pathname = new URL(req.url, "http://localhost").pathname;
  const requested = pathname === "/" ? "/index.html" : pathname;
  const file = path.resolve(root, `.${decodeURIComponent(requested)}`);
  if (
    !file.startsWith(`${root}${path.sep}`) &&
    file !== path.join(root, "index.html")
  ) {
    res.writeHead(403, { "content-type": "text/plain; charset=utf-8" });
    return res.end("Forbidden");
  }
  fs.readFile(file, (error, contents) => {
    if (error) {
      res.writeHead(error.code === "ENOENT" ? 404 : 500, {
        "content-type": "text/plain; charset=utf-8",
      });
      return res.end(
        error.code === "ENOENT" ? "Not found" : "Unable to read file",
      );
    }
    res.writeHead(200, {
      "content-type":
        mimeTypes[path.extname(file)] || "application/octet-stream",
      "x-content-type-options": "nosniff",
    });
    res.end(contents);
  });
}

const server = http.createServer((req, res) => {
  if (req.url === "/favicon.ico") {
    res.writeHead(204);
    return res.end();
  }
  if (req.url === "/api" || req.url.startsWith("/api/"))
    return apiHandler(req, res);
  if (!["GET", "HEAD"].includes(req.method)) {
    res.writeHead(405, { allow: "GET, HEAD" });
    return res.end("Method not allowed");
  }
  if (req.method === "HEAD") {
    const end = res.end.bind(res);
    res.end = (body) => end();
  }
  return serveFile(req, res);
});

const port = Number(process.env.PORT || 3000);
server.listen(port, "0.0.0.0", () =>
  console.log(`ISYEN server listening on http://localhost:${port}`),
);
