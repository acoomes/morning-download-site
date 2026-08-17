# AGENTS.md

## Mission

Maintain the public Morning Download reader at `https://morning-download.com/`. Optimize for readability, fast archive navigation, resilient content delivery, and small reversible changes.

## Read order

For most tasks, inspect files in this order:

1. `README.md` for architecture and operating model.
2. `app/MorningDownload.tsx` for data flow and interaction behavior.
3. `app/globals.css` for the design system and responsive rules.
4. `app/page.tsx` and `app/layout.tsx` for route metadata and document structure.
5. `tests/rendered-html.test.mjs` before changing rendered copy or structure.
6. `package.json`, `vite.config.ts`, and `worker/index.ts` only for build or runtime work.

Avoid scanning `data/briefs.json`, build output, dependency trees, or ignored `work/` files unless the task specifically concerns generated content.

## Source-of-truth boundaries

- Website code and presentation live in this repository.
- Briefing Markdown and editorial corrections live in `acoomes/morning-download`.
- The live JSON contract is `https://raw.githubusercontent.com/acoomes/morning-download/main/site/briefs.json`.
- `data/briefs.json` is a 30-edition availability fallback, not the primary live source.
- `.openai/hosting.json` identifies the existing Sites project. Preserve it and never invent or substitute a project ID.
- Do not commit secrets, generated build output, `.env` files, `node_modules`, or anything under `work/`.

## Data contract

Each briefing contains:

```ts
type Brief = {
  id: string;
  iso: string;
  day: string;
  weekday: string;
  full: string;
  month: string;
  edition: string;
  world: Array<{ icon: string; title: string; body: string }>;
  ai: Array<{ icon: string; title: string; body: string }>;
  closing: { sleeper: string; oneLiner: string };
  sources: Array<{ label: string; url: string }>;
};
```

Coordinate schema changes with the generator in `acoomes/morning-download/.github/scripts/generate-site-feed.mjs`. Keep fallback behavior intact: a remote outage must not blank the reader.

## Change recipes

### UI or interaction change

- Work primarily in `app/MorningDownload.tsx` and `app/globals.css`.
- Preserve keyboard search (`Cmd/Ctrl+K`), archive navigation, semantic headings, focus labels, and mobile behavior.
- Avoid introducing a component library for a small change; the current visual system is intentionally local.

### Content pipeline change

- Make feed-generation changes in the content repository first.
- Keep this app tolerant of a temporarily unavailable or malformed remote feed.
- Update the bundled fallback only when explicitly required and keep it to the 30 most recent editions.

### Hosting or runtime change

- This is a vinext application targeting Cloudflare-compatible runtime infrastructure through OpenAI Sites.
- Reuse the existing Sites project in `.openai/hosting.json`.
- Build and push the exact source state before saving and deploying a Sites version.
- Do not add D1, R2, authentication, or secrets unless the requested feature needs them.

## Required validation

Run the narrowest relevant check during iteration, then complete this sequence before handoff:

```bash
npm run lint
npm test
npm run build
```

`npm test` already performs a production build before the rendered-output checks. Report any existing warning separately from failures; do not claim success if a command exits nonzero.

## Review checklist

- The newest remote briefing can become the default selection after load.
- Archive counts and date ranges derive from data rather than hard-coded months.
- Remote failure still renders the bundled archive.
- External source links retain safe new-tab behavior.
- Desktop and mobile layouts remain readable.
- No secrets, temporary artifacts, or unrelated files are staged.

## Commit and handoff conventions

- Keep commits focused and use imperative messages.
- Keep the `Validate site` check green before merging a pull request.
- Explain user-visible behavior, validation performed, and deployment status in the handoff.
- For pull requests, include screenshots only when the visual design materially changed.
