#!/usr/bin/env node
/**
 * Detects this machine's LAN IPv4 address, then starts the realtime server
 * with PUBLIC_BASE_URL pointed at it so phones and the Fire TV on the same
 * Wi-Fi can reach it directly. Run from the repo root: `npm run dev:lan`.
 */
import { networkInterfaces } from "node:os";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

function findLanIPv4() {
  const nets = networkInterfaces();
  const candidates = [];
  for (const [name, addrs] of Object.entries(nets)) {
    for (const addr of addrs ?? []) {
      if (addr.family === "IPv4" && !addr.internal) {
        candidates.push({ name, address: addr.address });
      }
    }
  }
  // Prefer typical home-router ranges (192.168.x.x, 10.x.x.x) over VPN/virtual adapters.
  const preferred = candidates.find((c) => c.address.startsWith("192.168.") || c.address.startsWith("10."));
  return preferred?.address ?? candidates[0]?.address ?? null;
}

const ip = findLanIPv4();
if (!ip) {
  console.error(
    "Could not detect a LAN IPv4 address. Make sure you're connected to Wi-Fi/Ethernet,\n" +
      "then set PUBLIC_BASE_URL manually and run: npm run build:server && npm run --filter server start",
  );
  process.exit(1);
}

const port = process.env.PORT ?? "3000";
const publicBaseUrl = `http://${ip}:${port}`;

console.log(`\nBUMP RUN -- LAN development mode`);
console.log(`  Your LAN address:   ${ip}`);
console.log(`  Server + Controller: ${publicBaseUrl}`);
console.log(`  Point the Fire TV app's Settings -> Server address at the URL above.\n`);
console.log(
  `  Windows Firewall: if phones/Fire TV can't connect, allow Node.js through\n` +
    `  "Windows Defender Firewall" -> "Allow an app through firewall" for private networks.\n`,
);

const child = spawn("node", ["apps/server/dist/index.js"], {
  cwd: repoRoot,
  stdio: "inherit",
  env: { ...process.env, PORT: port, PUBLIC_BASE_URL: publicBaseUrl, NODE_ENV: process.env.NODE_ENV ?? "development" },
  shell: process.platform === "win32",
});

child.on("exit", (code) => process.exit(code ?? 0));
