import { readdir, readFile, writeFile } from "node:fs/promises";
import { join, basename } from "node:path";

const sourceRoot = join(process.cwd(), "work", "morning-download-main", "briefs");
const outputPath = join(process.cwd(), "data", "briefs.json");

const months = (await readdir(sourceRoot, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

function blocksBetween(markdown, start, end) {
  const slice = markdown.slice(start, end < 0 ? markdown.length : end);
  return slice
    .split(/\n\s*\n/)
    .map((block) => block.trim().replace(/\n(?![-#])/g, " "))
    .filter((block) => block && block !== "---" && !block.startsWith("##"));
}

function parseStory(block) {
  const normalized = block.replace(/\s+/g, " ").trim();
  const match = normalized.match(/^(.*?)\*\*(.+?)\*\*\s*(?:(?:—|–|-)\s*)?(.+)$/);
  if (!match) return null;
  const prefix = match[1].replace(/^-\s*/, "").trim();
  return { icon: prefix || "◆", title: match[2].trim(), body: match[3].trim() };
}

function parseSection(markdown, heading, nextHeading) {
  const start = markdown.indexOf(heading);
  const end = markdown.indexOf(nextHeading, start + heading.length);
  if (start < 0) return [];
  return blocksBetween(markdown, start + heading.length, end)
    .map(parseStory)
    .filter(Boolean);
}

function parseClosing(markdown) {
  const start = markdown.indexOf("## Closing");
  const end = markdown.indexOf("## Sources", start);
  if (start < 0) return { sleeper: "", oneLiner: "" };
  const closing = markdown.slice(start, end < 0 ? markdown.length : end);
  const sleeper = closing.match(/\*\*Sleeper Story:\*\*\s*([\s\S]*?)(?=\n\s*\n\*\*One-Liner:\*\*)/);
  const oneLiner = closing.match(/\*\*One-Liner:\*\*\s*([\s\S]*?)$/);
  return {
    sleeper: sleeper?.[1].replace(/\s+/g, " ").trim() ?? "",
    oneLiner: oneLiner?.[1].replace(/\s+/g, " ").trim() ?? "",
  };
}

function parseSources(markdown) {
  const start = markdown.indexOf("## Sources");
  if (start < 0) return [];
  return markdown
    .slice(start)
    .split("\n")
    .map((line) => line.trim().match(/^- \[(.+?)\]\((https?:\/\/.+?)\)$/))
    .filter(Boolean)
    .map((match) => ({ label: match[1], url: match[2] }));
}

function displayDate(id) {
  const iso = id.slice(0, 10);
  const date = new Date(`${iso}T12:00:00Z`);
  return {
    iso,
    day: new Intl.DateTimeFormat("en-US", { day: "2-digit", timeZone: "UTC" }).format(date),
    weekday: new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "UTC" }).format(date),
    full: new Intl.DateTimeFormat("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    }).format(date),
    month: new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(date),
  };
}

const briefs = [];
for (const month of months) {
  const monthPath = join(sourceRoot, month);
  const files = (await readdir(monthPath)).filter((name) => name.endsWith(".md")).sort();
  for (const file of files) {
    const markdown = await readFile(join(monthPath, file), "utf8");
    const id = basename(file, ".md");
    const date = displayDate(id);
    const world = parseSection(markdown, "## Section 1: World & Market Briefing", "## Section 2:");
    let ai = parseSection(markdown, "## Section 2: AI & Agentic Systems Briefing", "## Closing");
    if (!world.length && !ai.length && markdown.includes("## Special Report:")) {
      ai = blocksBetween(
        markdown,
        markdown.indexOf("## Special Report:") + "## Special Report:".length,
        markdown.indexOf("## Closing"),
      ).map(parseStory).filter(Boolean);
    }
    const closing = parseClosing(markdown);
    const sources = parseSources(markdown);
    const edition = id.includes("evening") ? "Evening edition" : id.includes("special") ? "Special edition" : "Morning edition";

    briefs.push({
      id,
      ...date,
      edition,
      world,
      ai,
      closing,
      sources,
    });
  }
}

briefs.sort((a, b) => b.id.localeCompare(a.id));
await writeFile(outputPath, `${JSON.stringify(briefs)}\n`);

const malformed = briefs.filter((brief) => brief.edition !== "Special edition" && (brief.world.length === 0 || brief.ai.length === 0));
console.log(`Generated ${briefs.length} briefings (${briefs.reduce((sum, brief) => sum + brief.world.length + brief.ai.length, 0)} stories).`);
if (malformed.length) {
  console.log(`Briefings with an empty section: ${malformed.map((brief) => brief.id).join(", ")}`);
}
