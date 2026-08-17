import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the Morning Download reader from fallback data", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, />Morning Download</);
  assert.match(html, /The signal before the noise\./);
  assert.match(html, /World &amp; Market Briefing/);
  assert.match(html, /AI &amp; Agentic Systems/);
  assert.match(html, /Sources &amp; further reading/);
  assert.match(html, /Search <kbd>⌘K<\/kbd>/);
});

test("keeps live-feed loading resilient", async () => {
  const component = await readFile(
    new URL("../app/MorningDownload.tsx", import.meta.url),
    "utf8",
  );

  assert.match(
    component,
    /https:\/\/raw\.githubusercontent\.com\/acoomes\/morning-download\/main\/site\/briefs\.json/,
  );
  assert.match(component, /useState<Brief\[]>\(fallbackBriefs\)/);
  assert.match(component, /cache:\s*"no-store"/);
  assert.match(component, /setBriefs\(parsed\)/);
  assert.match(component, /controller\.abort\(\)/);
  assert.match(component, /Using the bundled Morning Download archive/);
  assert.match(component, /\[briefs, deferredQuery\]/);
});

test("bundled fallback follows the live feed contract", async () => {
  const briefs = JSON.parse(
    await readFile(new URL("../data/briefs.json", import.meta.url), "utf8"),
  );

  assert.equal(briefs.length, 30);
  assert.deepEqual(
    [...briefs].map((brief) => brief.id),
    [...briefs].map((brief) => brief.id).sort((a, b) => b.localeCompare(a)),
  );

  for (const brief of briefs) {
    assert.equal(typeof brief.id, "string");
    assert.match(brief.iso, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(Array.isArray(brief.world));
    assert.ok(Array.isArray(brief.ai));
    assert.ok(Array.isArray(brief.sources));
    assert.equal(typeof brief.closing?.sleeper, "string");
    assert.equal(typeof brief.closing?.oneLiner, "string");
  }
});
