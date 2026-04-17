import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import process from "node:process";

const require = createRequire(import.meta.url);

function normalizeWindowsCwd() {
  if (process.platform !== "win32") return;
  const cwd = process.cwd();
  const normalized = cwd.replace(/^[a-z]:/, (drive) => drive.toUpperCase());
  if (normalized !== cwd) {
    process.chdir(normalized);
  }
}

normalizeWindowsCwd();

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("Usage: node scripts/next-win.mjs <next-arg...>");
  process.exit(1);
}

const nextCli = require.resolve("next/dist/bin/next");
const child = spawn(process.execPath, [nextCli, ...args], {
  stdio: "inherit",
  shell: false,
  cwd: process.cwd(),
  env: process.env,
});

child.on("error", (err) => {
  console.error("Failed to start Next.js:", err);
  process.exit(1);
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
