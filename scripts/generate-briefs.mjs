import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const contentRoot = resolve(process.argv[2] ?? "work/morning-download-main");
const outputPath = resolve(process.argv[3] ?? "data/briefs.json");
const generator = join(contentRoot, ".github/scripts/generate-site-feed.mjs");
const { generateFeed } = await import(pathToFileURL(generator).href);
if (typeof generateFeed !== "function") {
  throw new Error("Use the content branch with the exported generateFeed function.");
}
const previewPath = resolve("work/preview/briefs.json");
const briefs = await generateFeed({ root: contentRoot, outputPath: previewPath });
// Explicit fallback refreshes remain limited to the 30 newest editions.
if (outputPath !== previewPath) {
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(briefs.slice(0, 30))}\n`);
  console.log(`Saved the 30-edition fallback to ${outputPath}.`);
}
