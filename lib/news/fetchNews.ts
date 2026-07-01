// Holt aktuelle Fußball-News aus RSS-Feeds und filtert sie nach Team-Relevanz.
import Parser from "rss-parser";
import { FEEDS, teamKeywords } from "./feeds";

const parser = new Parser({ timeout: 10000 });

export type NewsItem = {
  title: string;
  summary: string;
  source: string;
  published: Date | null;
};

// Feeds pro Prozess einmal laden (Cache), nicht je Spiel neu.
let cache: NewsItem[] | null = null;

export async function loadAllNews(maxAgeDays = 10): Promise<NewsItem[]> {
  if (cache) return cache;
  const cutoff = Date.now() - maxAgeDays * 24 * 3600 * 1000;
  const items: NewsItem[] = [];

  await Promise.all(
    FEEDS.map(async (feed) => {
      try {
        const parsed = await parser.parseURL(feed.url);
        for (const it of parsed.items ?? []) {
          const published = it.isoDate ? new Date(it.isoDate) : it.pubDate ? new Date(it.pubDate) : null;
          if (published && published.getTime() < cutoff) continue;
          items.push({
            title: (it.title ?? "").trim(),
            summary: (it.contentSnippet ?? it.content ?? "").trim().slice(0, 240),
            source: feed.source,
            published,
          });
        }
      } catch {
        // Feed nicht erreichbar → überspringen.
      }
    })
  );

  cache = items;
  return items;
}

/** News, die eines der beiden Teams namentlich erwähnen (neueste zuerst, begrenzt). */
export async function getRelevantNews(teamNames: string[], limit = 6): Promise<NewsItem[]> {
  const all = await loadAllNews();
  const keywords = teamNames.flatMap(teamKeywords).map((k) => k.toLowerCase());

  const matched = all.filter((item) => {
    const hay = (item.title + " " + item.summary).toLowerCase();
    return keywords.some((k) => hay.includes(k));
  });

  matched.sort((a, b) => (b.published?.getTime() ?? 0) - (a.published?.getTime() ?? 0));
  // Duplikate (gleicher Titel) entfernen.
  const seen = new Set<string>();
  const unique = matched.filter((m) => (seen.has(m.title) ? false : seen.add(m.title)));
  return unique.slice(0, limit);
}
