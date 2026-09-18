"use strict";
// Run after npm ci: verify real Leaflet files, not a placeholder map library.
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const installed = require(path.join(root, "node_modules/leaflet/package.json"));
if (installed.version !== "1.9.4") throw new Error("Unexpected Leaflet version");
for (const file of ["leaflet.js", "leaflet.css", "images/marker-icon.png", "images/marker-shadow.png"]) {
  const full = path.join(root, "node_modules/leaflet/dist", file);
  if (!fs.existsSync(full) || !fs.statSync(full).isFile() || fs.statSync(full).size === 0) {
    throw new Error("Missing Leaflet map asset: " + file);
  }
}
console.log("Leaflet 1.9.4 - local map assets OK.");
