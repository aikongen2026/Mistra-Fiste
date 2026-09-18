"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const read = name => fs.readFileSync(path.join(root, name), "utf8");

test("Dockerfile is present at the exact default Render path", () => {
  assert.ok(fs.statSync(path.join(root, "Dockerfile")).isFile());
  assert.match(read("Dockerfile"), /^FROM node:22-bookworm-slim AS dependencies$/m);
  assert.match(read("Dockerfile"), /^FROM node:22-bookworm-slim AS production$/m);
});
test("Docker build installs locked runtime dependencies before copying the app", () => {
  const d = read("Dockerfile");
  assert.match(d, /COPY package\.json package-lock\.json \.\//);
  assert.match(d, /npm ci --omit=dev --ignore-scripts --no-audit --no-fund/);
  for (const name of ["server.js", "public", "scripts"]) {
    assert.ok(fs.existsSync(path.join(root, name)));
    assert.ok(d.includes(name));
  }
  assert.match(d, /node scripts\/verify-vendor\.js/);
});
test("Render configuration uses Docker with root build context and health endpoint", () => {
  const y = read("render.yaml");
  assert.match(y, /runtime: docker/);
  assert.match(y, /dockerfilePath: \.\/Dockerfile/);
  assert.match(y, /dockerContext: \./);
  assert.match(y, /healthCheckPath: \/api\/health/);
  assert.doesNotMatch(y, /runtime: node|buildCommand:|startCommand:/);
});
test("Container runs unprivileged and respects the runtime port with writable cache", () => {
  const d = read("Dockerfile");
  assert.match(d, /PORT=10000/);
  assert.match(d, /CACHE_DIR=\/app\/\.cache/);
  assert.match(d, /chown node:node \/app\/\.cache/);
  assert.match(d, /^USER node$/m);
  assert.match(d, /^CMD \["node", "server\.js"\]$/m);
  assert.match(read("server.js"), /process\.env\.PORT/);
  assert.match(read("server.js"), /'0\.0\.0\.0'/);
});
test("Build excludes local caches and secrets and never requires an NVE key", () => {
  const ignore = read(".dockerignore");
  for (const s of [".git", "**/node_modules", "**/.env", "**/.env.*", "**/*.key", "**/*.zip"]) {
    assert.ok(ignore.split("\n").includes(s));
  }
  assert.doesNotMatch(read("Dockerfile"), /(?:ARG|ENV) NVE_API_KEY/);
  assert.doesNotMatch(read("Dockerfile"), /^COPY (?:\. |\.env)/m);
});
test("Package, guide, frontend, and cache carry the same deployment version", () => {
  const p = JSON.parse(read("package.json"));
  const g = JSON.parse(read("public/data/mistra.json"));
  const lock = JSON.parse(read("package-lock.json"));
  assert.equal(p.version, "1.2.1");
  assert.equal(g.version, p.version);
  assert.equal(lock.version, p.version);
  assert.equal(lock.packages[""].version, p.version);
  assert.equal(lock.packages["node_modules/leaflet"].version, p.dependencies.leaflet);
  assert.ok(lock.packages["node_modules/leaflet"].integrity.startsWith("sha512-"));
  assert.match(read("public/index.html"), /<span>1\.2\.1<\/span>/);
  assert.match(read("public/sw.js"), /mistra-fiske-1\.2\.1/);
});
