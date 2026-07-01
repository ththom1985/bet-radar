// Client für The Odds API (v4).
// Docs: https://the-odds-api.com/liveapi/guides/v4/
// Free-Tier: 500 Requests/Monat — pro Liga 1 Request holt alle anstehenden Spiele.

const BASE = "https://api.the-odds-api.com/v4";

function key(): string {
  const k = process.env.ODDS_API_KEY;
  if (!k) throw new Error("ODDS_API_KEY fehlt in .env");
  return k;
}

export type OddsEvent = {
  id: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers: {
    title: string;
    markets: { key: string; outcomes: { name: string; price: number }[] }[];
  }[];
};

/** Holt die 1X2-Quoten (h2h) aller anstehenden Spiele einer Liga. */
export async function fetchOdds(sportKey: string): Promise<OddsEvent[]> {
  const url = `${BASE}/sports/${sportKey}/odds?regions=eu&markets=h2h&oddsFormat=decimal&apiKey=${key()}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Odds API ${res.status}: ${await res.text()}`);
  }
  return (await res.json()) as OddsEvent[];
}

/**
 * Extrahiert aus einem Event die besten 1X2-Quoten über alle Buchmacher.
 * Bei h2h heißen die Outcomes wie die Teams; "Draw" ist das Unentschieden.
 */
export function bestThreeWay(
  event: OddsEvent
): { home: number; draw: number; away: number; bookmaker: string } | null {
  let home = 0,
    draw = 0,
    away = 0;
  let bookmaker = "?";
  for (const bm of event.bookmakers) {
    const h2h = bm.markets.find((m) => m.key === "h2h");
    if (!h2h) continue;
    for (const o of h2h.outcomes) {
      if (o.name === event.home_team && o.price > home) {
        home = o.price;
        bookmaker = bm.title;
      } else if (o.name === event.away_team && o.price > away) {
        away = o.price;
      } else if (o.name === "Draw" && o.price > draw) {
        draw = o.price;
      }
    }
  }
  if (home && draw && away) return { home, draw, away, bookmaker };
  return null;
}

/** Normalisiert Teamnamen für den Abgleich zwischen den beiden APIs. */
export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // Akzente entfernen
    .replace(/\b(fc|cf|sc|ac|ss|as|ssc|vfl|vfb|club|calcio|deportivo)\b/g, "")
    .replace(/[^a-z0-9]/g, "")
    .trim();
}
