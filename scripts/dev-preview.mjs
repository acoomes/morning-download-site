import { spawn, spawnSync } from "node:child_process";
import { resolve } from "node:path";

const contentRoot = process.argv[2];
if (!contentRoot) {
  console.error('Usage: npm run dev:preview -- "/absolute/path/to/morning-download"');
  process.exit(1);
}
const previewPath = resolve("work/preview/briefs.json");
const generated = spawnSync(process.execPath, ["scripts/generate-briefs.mjs", contentRoot, previewPath], { stdio: "inherit" });
if (generated.error) throw generated.error;
if (generated.status !== 0) process.exit(generated.status ?? 1);

const server = spawn(process.execPath, ["node_modules/vinext/dist/cli.js", "dev", "--host", "127.0.0.1", ...process.argv.slice(3)], {
  stdio: "inherit",
  env: { ...process.env, MORNING_DOWNLOAD_PREVIEW_FEED: previewPath, WRANGLER_LOG_PATH: ".wrangler/wrangler.log" },
});
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => server.kill(signal));
server.on("error", (error) => { console.error(error); process.exit(1); });
server.on("exit", (code) => process.exit(code ?? 0));
