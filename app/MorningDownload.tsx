"use client";

import { Fragment, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import briefData from "../data/briefs.json";

type Story = { icon: string; title: string; body: string };
type Source = { label: string; url: string };
type Brief = {
  id: string;
  iso: string;
  day: string;
  weekday: string;
  full: string;
  month: string;
  edition: string;
  world: Story[];
  ai: Story[];
  closing: { sleeper: string; oneLiner: string };
  sources: Source[];
};

const fallbackBriefs = briefData as Brief[];
const liveFeedUrl = "https://raw.githubusercontent.com/acoomes/morning-download/main/site/briefs.json";
type SectionFilter = "all" | "world" | "ai";

function InlineText({ text }: { text: string }) {
  const tokens = text.split(/(\*\*.*?\*\*|\[[^\]]+\]\(https?:\/\/[^)]+\)|`[^`]+`)/g);
  return (
    <>
      {tokens.map((token, index) => {
        const bold = token.match(/^\*\*(.*?)\*\*$/);
        const link = token.match(/^\[([^\]]+)\]\((https?:\/\/[^)]+)\)$/);
        const code = token.match(/^`([^`]+)`$/);
        if (bold) return <strong key={index}>{bold[1]}</strong>;
        if (link) return <a key={index} href={link[2]} target="_blank" rel="noreferrer">{link[1]}</a>;
        if (code) return <code key={index}>{code[1]}</code>;
        return <Fragment key={index}>{token}</Fragment>;
      })}
    </>
  );
}

function StoryCard({ story, number }: { story: Story; number: number }) {
  return (
    <article className="story">
      <div className="story-meta">
        <span className="story-icon" aria-hidden="true">{story.icon}</span>
        <span className="story-number">{String(number).padStart(2, "0")}</span>
      </div>
      <div>
        <h3><InlineText text={story.title} /></h3>
        <p><InlineText text={story.body} /></p>
      </div>
    </article>
  );
}

function BriefSection({
  kind,
  stories,
}: {
  kind: "world" | "ai";
  stories: Story[];
}) {
  if (!stories.length) return null;
  const isWorld = kind === "world";
  return (
    <section className={`brief-section ${kind}`} id={kind}>
      <div className="section-heading">
        <span>{isWorld ? "01" : "02"}</span>
        <div>
          <p>{isWorld ? "World & Market Briefing" : "AI & Agentic Systems"}</p>
          <h2>{stories.length} signals to carry into the day.</h2>
        </div>
      </div>
      {stories.map((story, index) => (
        <StoryCard key={`${story.title}-${index}`} story={story} number={index + 1} />
      ))}
    </section>
  );
}

export default function MorningDownload() {
  const [briefs, setBriefs] = useState<Brief[]>(fallbackBriefs);
  const [selectedId, setSelectedId] = useState(fallbackBriefs[0].id);
  const [section, setSection] = useState<SectionFilter>("all");
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());
  const searchRef = useRef<HTMLInputElement>(null);

  const selectedIndex = Math.max(0, briefs.findIndex((brief) => brief.id === selectedId));
  const brief = briefs[selectedIndex];
  const recentBriefs = briefs.slice(0, 7);
  const older = briefs[selectedIndex + 1];
  const newer = briefs[selectedIndex - 1];

  const archiveRange = useMemo(() => {
    const oldest = briefs.at(-1);
    const newest = briefs[0];
    if (!oldest || !newest) return "";
    const oldestDate = new Date(`${oldest.iso}T12:00:00Z`);
    const newestDate = new Date(`${newest.iso}T12:00:00Z`);
    const month = new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" });
    const year = new Intl.DateTimeFormat("en-US", { year: "numeric", timeZone: "UTC" });
    const oldestYear = year.format(oldestDate);
    const newestYear = year.format(newestDate);
    return oldestYear === newestYear
      ? `${month.format(oldestDate)}–${month.format(newestDate)} ${newestYear}`
      : `${month.format(oldestDate)} ${oldestYear}–${month.format(newestDate)} ${newestYear}`;
  }, [briefs]);

  const filteredBriefs = useMemo(() => {
    if (!deferredQuery) return briefs;
    return briefs.filter((item) => {
      const haystack = [
        item.full,
        item.edition,
        ...item.world.flatMap((story) => [story.title, story.body]),
        ...item.ai.flatMap((story) => [story.title, story.body]),
        item.closing.sleeper,
        item.closing.oneLiner,
      ].join(" ").toLowerCase();
      return haystack.includes(deferredQuery);
    });
  }, [briefs, deferredQuery]);

  const groupedBriefs = useMemo(() => {
    const groups = new Map<string, Brief[]>();
    filteredBriefs.forEach((item) => groups.set(item.month, [...(groups.get(item.month) ?? []), item]));
    return [...groups.entries()];
  }, [filteredBriefs]);

  useEffect(() => {
    const controller = new AbortController();
    const cacheWindow = Math.floor(Date.now() / 300_000);
    fetch(`${liveFeedUrl}?v=${cacheWindow}`, { cache: "no-store", signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Live feed returned ${response.status}`);
        return response.json();
      })
      .then((nextBriefs: unknown) => {
        if (!Array.isArray(nextBriefs) || !nextBriefs.length) {
          throw new Error("Live feed did not contain any briefings");
        }
        const parsed = nextBriefs as Brief[];
        setBriefs(parsed);
        setSelectedId((current) => current === fallbackBriefs[0].id ? parsed[0].id : current);
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        console.warn("Using the bundled Morning Download archive because the live feed is unavailable.", error);
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setArchiveOpen(false);
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setArchiveOpen(true);
        window.setTimeout(() => searchRef.current?.focus(), 0);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  function chooseBrief(id: string) {
    setSelectedId(id);
    setArchiveOpen(false);
    setQuery("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function openArchive(focusSearch = false) {
    setArchiveOpen(true);
    if (focusSearch) window.setTimeout(() => searchRef.current?.focus(), 0);
  }

  return (
    <main>
      <div className="progress" aria-hidden="true" />
      <header className="masthead">
        <button className="brand" type="button" onClick={() => chooseBrief(briefs[0].id)} aria-label="Open latest Morning Download">
          <span className="brand-mark">MD</span>
          <span>Morning Download</span>
        </button>
        <div className="header-actions">
          <span className="issue-count">{briefs.length} briefings · {archiveRange}</span>
          <button className="header-button" type="button" onClick={() => openArchive(true)}>
            <span aria-hidden="true">⌕</span> Search <kbd>⌘K</kbd>
          </button>
          <button className="header-button archive-trigger" type="button" onClick={() => openArchive(false)}>
            Archive <span aria-hidden="true">↗</span>
          </button>
        </div>
      </header>

      {archiveOpen && (
        <section className="archive-panel" aria-label="Briefing archive">
          <div className="archive-top">
            <div>
              <p className="eyebrow">The complete collection</p>
              <h2>Briefing archive</h2>
            </div>
            <button className="close-button" type="button" onClick={() => setArchiveOpen(false)} aria-label="Close archive">×</button>
          </div>
          <label className="search-box">
            <span aria-hidden="true">⌕</span>
            <input
              ref={searchRef}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search topics, companies, or signals"
              aria-label="Search all briefings"
            />
            <kbd>esc</kbd>
          </label>
          <p className="result-count" aria-live="polite">
            {filteredBriefs.length} {filteredBriefs.length === 1 ? "edition" : "editions"}
            {deferredQuery ? ` matching “${query.trim()}”` : ""}
          </p>
          <div className="archive-list">
            {groupedBriefs.length ? groupedBriefs.map(([month, items]) => (
              <div className="archive-month" key={month}>
                <h3>{month}</h3>
                <div>
                  {items.map((item) => (
                    <button
                      type="button"
                      key={item.id}
                      className={item.id === selectedId ? "current" : ""}
                      onClick={() => chooseBrief(item.id)}
                    >
                      <span className="archive-date"><strong>{item.day}</strong><small>{item.weekday}</small></span>
                      <span>
                        <strong>{item.edition}</strong>
                        <small>{item.world.length + item.ai.length} stories · {item.sources.length} sources</small>
                      </span>
                      <span aria-hidden="true">→</span>
                    </button>
                  ))}
                </div>
              </div>
            )) : (
              <div className="empty-state">
                <span aria-hidden="true">◎</span>
                <h3>No signals found</h3>
                <p>Try a broader search, like “markets,” “agents,” or “OpenAI.”</p>
              </div>
            )}
          </div>
        </section>
      )}

      {!archiveOpen && (
        <>
          <section className="hero" id="top">
            <div>
              <p className="eyebrow">{brief.full} · {brief.edition}</p>
              <h1>The signal before the noise.</h1>
              <p className="dek">A sharp morning read on world events, markets, AI, and the systems changing how work gets done.</p>
            </div>
            <div className="hero-seal" aria-hidden="true">
              <span>Daily brief</span>
              <strong>{brief.day}</strong>
              <small>{brief.weekday}</small>
            </div>
            <div className="edition-tabs" aria-label="Filter briefing sections">
              {([
                ["all", "Full briefing"],
                ["world", "World & markets"],
                ["ai", "AI & agents"],
              ] as const).map(([value, label]) => (
                <button
                  type="button"
                  key={value}
                  className={section === value ? "active" : ""}
                  onClick={() => setSection(value)}
                >
                  {label}
                </button>
              ))}
            </div>
          </section>

          <div className="reader-grid">
            <aside className="date-rail" aria-label="Recent editions">
              <p className="rail-label">Recent editions</p>
              {recentBriefs.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  className={item.id === selectedId ? "selected" : ""}
                  onClick={() => chooseBrief(item.id)}
                  aria-label={item.full}
                >
                  <strong>{item.day}</strong><span>{item.weekday}</span>
                </button>
              ))}
              <button className="browse-link" type="button" onClick={() => openArchive(false)}>Browse all {briefs.length}</button>
            </aside>

            <article className="briefing" aria-live="polite">
              <div className="edition-label">
                <span>{brief.edition}</span>
                <span>{brief.world.length + brief.ai.length} stories</span>
                <span>{brief.sources.length} sources</span>
              </div>

              {(section === "all" || section === "world") && <BriefSection kind="world" stories={brief.world} />}
              {(section === "all" || section === "ai") && <BriefSection kind="ai" stories={brief.ai} />}

              {(brief.closing.sleeper || brief.closing.oneLiner) && (
                <section className="closing">
                  {brief.closing.sleeper && (
                    <div className="sleeper">
                      <p>Sleeper story</p>
                      <h2>The story beneath the headlines.</h2>
                      <div><InlineText text={brief.closing.sleeper} /></div>
                    </div>
                  )}
                  {brief.closing.oneLiner && (
                    <aside className="one-liner">
                      <p>Today in one line</p>
                      <blockquote><InlineText text={brief.closing.oneLiner} /></blockquote>
                    </aside>
                  )}
                </section>
              )}

              {brief.sources.length > 0 && (
                <details className="sources">
                  <summary>
                    <span>Sources & further reading</span>
                    <span>{brief.sources.length} links <b aria-hidden="true">+</b></span>
                  </summary>
                  <ol>
                    {brief.sources.map((source, index) => (
                      <li key={`${source.url}-${index}`}>
                        <span>{String(index + 1).padStart(2, "0")}</span>
                        <a href={source.url} target="_blank" rel="noreferrer">{source.label}</a>
                      </li>
                    ))}
                  </ol>
                </details>
              )}

              <nav className="issue-nav" aria-label="Navigate between briefings">
                <div>
                  {older && (
                    <button type="button" onClick={() => chooseBrief(older.id)}>
                      <span>← Older</span><strong>{older.full.replace(/, 2026$/, "")}</strong>
                    </button>
                  )}
                </div>
                <div>
                  {newer && (
                    <button type="button" onClick={() => chooseBrief(newer.id)}>
                      <span>Newer →</span><strong>{newer.full.replace(/, 2026$/, "")}</strong>
                    </button>
                  )}
                </div>
              </nav>
            </article>
          </div>

          <footer>
            <div className="brand footer-brand"><span className="brand-mark">MD</span><span>Morning Download</span></div>
            <p>Daily news briefings covering world events, markets, and AI systems.</p>
            <a href="https://github.com/acoomes/morning-download" target="_blank" rel="noreferrer">View source on GitHub ↗</a>
          </footer>
        </>
      )}
    </main>
  );
}
