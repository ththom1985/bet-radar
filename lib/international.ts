// Internationale Pipeline MIT DB-Persistenz: Elo aus Länderspielen (+ laufende WM) →
// Vorhersage & Value für die aktuellen WM-Spiele → in die DB (erscheint im Dashboard).

import { prisma } from "./prisma";
import { fetchFixtures, isFinished } from "./clients/apiFootball";
import { fetchOdds, bestThreeWay } from "./clients/oddsApi";
import { getMatches as getFdMatches } from "./clients/footballDataOrg";
import { normalizeNation } from "./nations";
import { EloModel, type EloMatch } from "./model/elo";
import { matchProbabilities } from "./model/poisson";
import { findValue } from "./model/value";

const WC_API_ID = 1; // API-Football-Liga-ID der WM (als Sentinel für die League-Zeile)
const WC_SEASON = 2026;
const MODEL = "elo-v1";
const MIN_GAMES = 8;
const MIN_ODDS = 1.8;
const MIN_EDGE = 0.05;
const MAX_EDGE = 0.4;

const HISTORY: { league: number; season: number; weight: number; neutral: boolean }[] = [
  { league: 1, season: 2022, weight: 2.5, neutral: true }, // WM 2022
  { league: 4, season: 2024, weight: 2.5, neutral: true }, // EM 2024
  { league: 5, season: 2024, weight: 2.0, neutral: false }, // Nations League
  { league: 5, season: 2022, weight: 2.0, neutral: false },
  { league: 9, season: 2024, weight: 2.5, neutral: true }, // Copa America
  { league: 6, season: 2023, weight: 2.5, neutral: true }, // Afrika-Cup
  { league: 10, season: 2024, weight: 1.0, neutral: false }, // Freundschaftsspiele
  { league: 10, season: 2023, weight: 1.0, neutral: false },
  { league: 10, season: 2022, weight: 1.0, neutral: false },
];

function pct(x: number) {
  return Math.round(x * 100);
}

export async function runInternational() {
  // Elo trainieren (Historie + laufende WM).
  const elo = new EloModel();
  const matches: EloMatch[] = [];
  const display = new Map<string, string>(); // normalisiert -> lesbarer Name
  const rec = (name: string) => {
    const k = normalizeNation(name);
    if (!display.has(k)) display.set(k, name);
    return k;
  };
  for (const h of HISTORY) {
    try {
      const fx = await fetchFixtures(h.league, h.season);
      for (const f of fx) {
        if (!isFinished(f.fixture.status.short) || f.goals.home == null || f.goals.away == null) continue;
        matches.push({
          homeTeam: rec(f.teams.home.name),
          awayTeam: rec(f.teams.away.name),
          homeGoals: f.goals.home,
          awayGoals: f.goals.away,
          date: new Date(f.fixture.date),
          weight: h.weight,
          neutral: h.neutral,
        });
      }
    } catch {
      /* Wettbewerb nicht verfügbar → überspringen */
    }
  }
  try {
    const wc = (await getFdMatches("WC", WC_SEASON)).filter((m) => m.finished);
    for (const m of wc) {
      matches.push({
        homeTeam: rec(m.homeTeam),
        awayTeam: rec(m.awayTeam),
        homeGoals: m.homeGoals,
        awayGoals: m.awayGoals,
        date: m.date,
        weight: 2.5,
        neutral: true,
      });
    }
  } catch {
    /* WM-Ergebnisse aktuell nicht verfügbar */
  }
  elo.train(matches);

  // Weltrangliste (lesbare Namen, genug Spiele) als Snapshot speichern → Ranglisten-Seite.
  const ranking = elo
    .ranking()
    .map((r) => ({ team: display.get(r.team) ?? r.team, rating: r.rating, games: elo.games(r.team) }))
    .filter((r) => r.games >= 5)
    .slice(0, 48);
  await prisma.snapshot.upsert({
    where: { key: "elo-ranking" },
    create: { key: "elo-ranking", value: JSON.stringify(ranking) },
    update: { value: JSON.stringify(ranking) },
  });

  // WM-Liga sicherstellen.
  const league = await prisma.league.upsert({
    where: { apiFootballId: WC_API_ID },
    create: {
      name: "WM 2026",
      country: "International",
      apiFootballId: WC_API_ID,
      oddsApiKey: "soccer_fifa_world_cup",
      season: WC_SEASON,
    },
    update: {},
  });

  // Team-Auflösung (nach normalisiertem Nationsnamen).
  const teams = await prisma.team.findMany({ where: { leagueId: league.id } });
  const index = new Map<string, number>();
  for (const t of teams) index.set(normalizeNation(t.name), t.id);
  async function resolveTeam(name: string): Promise<number> {
    const key = normalizeNation(name);
    if (index.has(key)) return index.get(key)!;
    const created = await prisma.team.create({ data: { name, leagueId: league.id } });
    index.set(key, created.id);
    return created.id;
  }

  // Aktuelle WM-Quoten holen.
  const events = await fetchOdds("soccer_fifa_world_cup");
  let stored = 0;
  let valueCount = 0;

  for (const ev of events) {
    const three = bestThreeWay(ev);
    if (!three) continue;
    const homeId = await resolveTeam(ev.home_team);
    const awayId = await resolveTeam(ev.away_team);
    const hk = normalizeNation(ev.home_team);
    const ak = normalizeNation(ev.away_team);

    const fx = await prisma.fixture.upsert({
      where: { oddsEventId: ev.id },
      create: {
        oddsEventId: ev.id,
        leagueId: league.id,
        homeTeamId: homeId,
        awayTeamId: awayId,
        kickoff: new Date(ev.commence_time),
        season: WC_SEASON,
        round: "WM 2026",
        status: "SCHEDULED",
      },
      update: { kickoff: new Date(ev.commence_time) },
    });
    await prisma.oddsSnapshot.create({
      data: {
        fixtureId: fx.id,
        bookmaker: three.bookmaker,
        homeOdds: three.home,
        drawOdds: three.draw,
        awayOdds: three.away,
      },
    });
    stored++;

    // Nur bei genug Datenbasis werten.
    const gH = elo.games(hk);
    const gA = elo.games(ak);
    await prisma.valueBet.deleteMany({ where: { fixtureId: fx.id } });
    if (gH < MIN_GAMES || gA < MIN_GAMES) continue;

    const { expHomeGoals, expAwayGoals } = elo.expectedGoals(hk, ak, true);
    const probs = matchProbabilities(expHomeGoals, expAwayGoals);
    await prisma.prediction.upsert({
      where: { fixtureId_model: { fixtureId: fx.id, model: MODEL } },
      create: { fixtureId: fx.id, model: MODEL, expHomeGoals, expAwayGoals, pHome: probs.pHome, pDraw: probs.pDraw, pAway: probs.pAway },
      update: { expHomeGoals, expAwayGoals, pHome: probs.pHome, pDraw: probs.pDraw, pAway: probs.pAway },
    });

    const candidates = findValue(probs, three, { minOdds: MIN_ODDS, minEdge: MIN_EDGE }).filter((c) => c.edge <= MAX_EDGE);
    for (const c of candidates) {
      const selName = c.selection === "HOME" ? ev.home_team : c.selection === "AWAY" ? ev.away_team : "Unentschieden";
      const reason =
        `Elo-Modell (Länderspiele inkl. laufender WM): ${selName} mit ${pct(c.modelProb)}% Modell-Wahrscheinlichkeit ` +
        `gegenüber ${pct(c.impliedProb)}% laut Quote (${c.odds.toFixed(2)}). ` +
        `Elo ${ev.home_team} ${Math.round(elo.rating(hk))} vs ${ev.away_team} ${Math.round(elo.rating(ak))}. ` +
        `Hinweis: internationale Märkte sind effizient; Kader-/Formdetails über die Quote hinaus fehlen.`;
      await prisma.valueBet.create({
        data: {
          fixtureId: fx.id,
          selection: c.selection,
          modelProb: c.modelProb,
          bestOdds: c.odds,
          impliedProb: c.impliedProb,
          edge: c.edge,
          bookmaker: three.bookmaker,
          reasoning: reason,
        },
      });
      valueCount++;
    }
  }

  return { stored, valueCount, ranking: ranking.slice(0, 10) };
}
