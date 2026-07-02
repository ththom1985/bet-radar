// Tennis-Pipeline: belagsabhängiges Elo aus tennis-data.co.uk + Quoten (Odds API)
// → 2-Wege-Value in dieselbe DB (erscheint im Dashboard & Tracker wie Fußball).

import { prisma } from "./prisma";
import { fetchTennisMatches } from "./clients/tennisData";
import { fetchOdds, REFERENCE_BOOKMAKER, type OddsEvent } from "./clients/oddsApi";
import { normalizePlayer } from "./players";
import { findValueTwoWay } from "./model/value";

const MODEL = "elo-tennis-v1";
const MIN_GAMES = 10;
const MIN_ODDS = 1.8;
const MIN_EDGE = 0.05;
const MAX_EDGE = 0.4;
const MAX_ODDS = 8; // keine extremen Außenseiter (fast immer Modellrauschen)
const YEARS = [2024, 2025, 2026];

// Belag aus dem Turnier-Key ableiten (wichtig: Wimbledon = Rasen!).
function surfaceForKey(sk: string): string {
  if (/wimbledon|queens|halle|grass|eastbourne/i.test(sk)) return "Grass";
  if (/french|roland|clay|monte|madrid|rome|hamburg|kitzbuhel/i.test(sk)) return "Clay";
  return "Hard";
}

// --- Belagsabhängiges Elo ---
class TennisElo {
  private overall = new Map<string, number>();
  private surface = new Map<string, Map<string, number>>();
  private counts = new Map<string, number>();

  games(p: string) {
    return this.counts.get(p) ?? 0;
  }
  private surfRating(surf: string, p: string) {
    return this.surface.get(surf)?.get(p) ?? 1500;
  }
  rating(p: string, surf: string) {
    return 0.5 * (this.overall.get(p) ?? 1500) + 0.5 * this.surfRating(surf, p);
  }
  /** P(a gewinnt) auf diesem Belag. */
  prob(a: string, b: string, surf: string) {
    const dr = this.rating(a, surf) - this.rating(b, surf);
    return 1 / (1 + Math.pow(10, -dr / 400));
  }
  train(matches: { winner: string; loser: string; surface: string; date: Date }[]) {
    const sorted = [...matches].sort((a, b) => a.date.getTime() - b.date.getTime());
    for (const m of sorted) {
      const w = normalizePlayer(m.winner);
      const l = normalizePlayer(m.loser);
      if (!w || !l || w === l) continue;
      this.updateOne(this.overall, w, l);
      let sm = this.surface.get(m.surface);
      if (!sm) this.surface.set(m.surface, (sm = new Map()));
      this.updateOne(sm, w, l);
      this.counts.set(w, this.games(w) + 1);
      this.counts.set(l, this.games(l) + 1);
    }
  }
  private updateOne(map: Map<string, number>, w: string, l: string, K = 32) {
    const rw = map.get(w) ?? 1500;
    const rl = map.get(l) ?? 1500;
    const ew = 1 / (1 + Math.pow(10, (rl - rw) / 400));
    const delta = K * (1 - ew);
    map.set(w, rw + delta);
    map.set(l, rl - delta);
  }
}

// 2-Wege-Quoten: Referenz-Buchmacher bevorzugt, sonst beste.
function bestTwoWay(ev: OddsEvent): { home: number; away: number; bookmaker: string } | null {
  const pick = (bm: OddsEvent["bookmakers"][number]) => {
    const h2h = bm.markets.find((m) => m.key === "h2h");
    if (!h2h) return null;
    let home = 0,
      away = 0;
    for (const o of h2h.outcomes) {
      if (o.name === ev.home_team) home = o.price;
      else if (o.name === ev.away_team) away = o.price;
    }
    return home && away ? { home, away } : null;
  };
  const ref = ev.bookmakers.find((b) => b.title === REFERENCE_BOOKMAKER);
  if (ref) {
    const r = pick(ref);
    if (r) return { ...r, bookmaker: REFERENCE_BOOKMAKER };
  }
  let home = 0,
    away = 0,
    bookmaker = "?";
  for (const bm of ev.bookmakers) {
    const r = pick(bm);
    if (r) {
      if (r.home > home) {
        home = r.home;
        bookmaker = bm.title;
      }
      if (r.away > away) away = r.away;
    }
  }
  return home && away ? { home, away, bookmaker } : null;
}

// Aktive Tennis-Wettbewerbe der Odds API für eine Tour.
async function tennisSportKeys(tour: "atp" | "wta"): Promise<string[]> {
  const res = await fetch(`https://api.the-odds-api.com/v4/sports/?apiKey=${process.env.ODDS_API_KEY}`);
  const sports = (await res.json()) as { key: string; active: boolean }[];
  return sports.filter((s) => s.active && s.key.startsWith(`tennis_${tour}`)).map((s) => s.key);
}

const TOURS = [
  { tour: "atp" as const, league: "Tennis ATP", apiId: 9001, oddsKey: "tennis_atp" },
  { tour: "wta" as const, league: "Tennis WTA", apiId: 9002, oddsKey: "tennis_wta" },
];

export async function runTennis() {
  let stored = 0;
  let valueCount = 0;

  for (const cfg of TOURS) {
    // 1) Elo trainieren
    const elo = new TennisElo();
    const matches: { winner: string; loser: string; surface: string; date: Date }[] = [];
    for (const y of YEARS) {
      try {
        matches.push(...(await fetchTennisMatches(cfg.tour, y)));
      } catch {
        /* Jahr nicht verfügbar */
      }
    }
    if (matches.length === 0) continue;
    elo.train(matches);

    // 2) Liga + Spieler-Index
    const league = await prisma.league.upsert({
      where: { apiFootballId: cfg.apiId },
      create: { name: cfg.league, country: "International", apiFootballId: cfg.apiId, oddsApiKey: cfg.oddsKey, season: 2026 },
      update: {},
    });
    const teams = await prisma.team.findMany({ where: { leagueId: league.id } });
    const index = new Map<string, number>();
    for (const t of teams) index.set(normalizePlayer(t.name), t.id);
    const resolve = async (name: string) => {
      const key = normalizePlayer(name);
      if (index.has(key)) return index.get(key)!;
      const created = await prisma.team.create({ data: { name, leagueId: league.id } });
      index.set(key, created.id);
      return created.id;
    };

    // 3) Anstehende Matches + Quoten
    const keys = await tennisSportKeys(cfg.tour);
    const seen = new Set<string>();
    for (const sk of keys) {
      let events: OddsEvent[] = [];
      try {
        events = await fetchOdds(sk);
      } catch {
        continue;
      }
      const surf = surfaceForKey(sk);
      for (const ev of events) {
        const two = bestTwoWay(ev);
        if (!two) continue;
        const hk = normalizePlayer(ev.home_team);
        const ak = normalizePlayer(ev.away_team);
        const pairKey = [hk, ak].sort().join("|");
        if (seen.has(pairKey)) continue;
        seen.add(pairKey);

        const homeId = await resolve(ev.home_team);
        const awayId = await resolve(ev.away_team);
        const fx = await prisma.fixture.upsert({
          where: { oddsEventId: ev.id },
          create: {
            oddsEventId: ev.id,
            leagueId: league.id,
            homeTeamId: homeId,
            awayTeamId: awayId,
            kickoff: new Date(ev.commence_time),
            season: 2026,
            round: cfg.league,
            status: "SCHEDULED",
          },
          update: { kickoff: new Date(ev.commence_time) },
        });
        await prisma.oddsSnapshot.create({
          data: { fixtureId: fx.id, bookmaker: two.bookmaker, homeOdds: two.home, drawOdds: 0, awayOdds: two.away },
        });
        stored++;

        await prisma.valueBet.deleteMany({ where: { fixtureId: fx.id } });
        if (elo.games(hk) < MIN_GAMES || elo.games(ak) < MIN_GAMES) continue;

        const pHome = elo.prob(hk, ak, surf);
        await prisma.prediction.upsert({
          where: { fixtureId_model: { fixtureId: fx.id, model: MODEL } },
          create: { fixtureId: fx.id, model: MODEL, expHomeGoals: 0, expAwayGoals: 0, pHome, pDraw: 0, pAway: 1 - pHome },
          update: { pHome, pDraw: 0, pAway: 1 - pHome },
        });

        const cands = findValueTwoWay(pHome, 1 - pHome, two.home, two.away, { minOdds: MIN_ODDS, minEdge: MIN_EDGE })
          .filter((c) => c.edge <= MAX_EDGE && c.odds <= MAX_ODDS)
          .slice(0, 1);
        for (const c of cands) {
          const selName = c.selection === "HOME" ? ev.home_team : ev.away_team;
          await prisma.valueBet.create({
            data: {
              fixtureId: fx.id,
              selection: c.selection,
              modelProb: c.modelProb,
              bestOdds: c.odds,
              impliedProb: c.impliedProb,
              edge: c.edge,
              bookmaker: two.bookmaker,
              reasoning:
                `Belag-Elo (${cfg.league}): ${selName} mit ${Math.round(c.modelProb * 100)}% Modell vs ` +
                `${Math.round(c.impliedProb * 100)}% laut Quote (${c.odds.toFixed(2)}). ` +
                `Rein statistisch aus Spielstärke; Verletzungen/Tagesform/Aufgaben nicht einbezogen.`,
            },
          });
          valueCount++;
        }
      }
    }

    // 4) Jüngste Ergebnisse (14 Tage) als FINISHED speichern → für Tracker-Abrechnung
    const cutoff = Date.now() - 14 * 864e5;
    for (const m of matches) {
      if (m.date.getTime() < cutoff) continue;
      const homeId = await resolve(m.winner);
      const awayId = await resolve(m.loser);
      await prisma.fixture.upsert({
        where: { oddsEventId: `td:${cfg.tour}:${normalizePlayer(m.winner)}:${normalizePlayer(m.loser)}:${m.date.toISOString().slice(0, 10)}` },
        create: {
          oddsEventId: `td:${cfg.tour}:${normalizePlayer(m.winner)}:${normalizePlayer(m.loser)}:${m.date.toISOString().slice(0, 10)}`,
          leagueId: league.id,
          homeTeamId: homeId,
          awayTeamId: awayId,
          kickoff: m.date,
          season: 2026,
          round: "Ergebnis",
          status: "FINISHED",
          homeGoals: 1,
          awayGoals: 0,
        },
        update: {},
      });
    }
  }

  return { stored, valueCount };
}
