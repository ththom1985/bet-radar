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

// Referenz-Buchmacher: die Quoten, die der Nutzer real bekommt (Tipico ≈ Interwetten-Niveau).
// Per Env änderbar. Falls dieser ein Spiel nicht anbietet → beste verfügbare Quote.
export const REFERENCE_BOOKMAKER = process.env.REFERENCE_BOOKMAKER || "Tipico";

type ThreeWayResult = { home: number; draw: number; away: number; bookmaker: string };

/** 1X2-Quoten genau eines Buchmachers (oder null, wenn er das Spiel nicht komplett anbietet). */
function bookmakerThreeWay(event: OddsEvent, title: string): ThreeWayResult | null {
  const bm = event.bookmakers.find((b) => b.title === title);
  const h2h = bm?.markets.find((m) => m.key === "h2h");
  if (!h2h) return null;
  let home = 0,
    draw = 0,
    away = 0;
  for (const o of h2h.outcomes) {
    if (o.name === event.home_team) home = o.price;
    else if (o.name === event.away_team) away = o.price;
    else if (o.name === "Draw") draw = o.price;
  }
  return home && draw && away ? { home, draw, away, bookmaker: title } : null;
}

/**
 * 1X2-Quoten für das Value-Modell: bevorzugt den Referenz-Buchmacher (Tipico),
 * sonst die beste verfügbare Quote über alle Buchmacher.
 */
export function bestThreeWay(event: OddsEvent): ThreeWayResult | null {
  // 1) Referenz-Buchmacher (das, was der Nutzer real bekommt)
  const ref = bookmakerThreeWay(event, REFERENCE_BOOKMAKER);
  if (ref) return ref;

  // 2) Fallback: beste Quote über alle Buchmacher
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
