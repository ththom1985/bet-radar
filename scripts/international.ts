// Internationale Pipeline: Elo aus historischen Länderspielen → Vorhersage & Value
// für die aktuellen WM-Spiele (Quoten von The Odds API).
// Aufruf: npx tsx --env-file=.env scripts/international.ts

import { fetchFixtures, isFinished } from "../lib/clients/apiFootball";
import { fetchOdds, bestThreeWay } from "../lib/clients/oddsApi";
import { EloModel, type EloMatch } from "../lib/model/elo";
import { matchProbabilities } from "../lib/model/poisson";
import { findValue } from "../lib/model/value";

// Historische Wettbewerbe (API-Football, Free-Tier: 2022–2024).
const HISTORY: { name: string; league: number; season: number; weight: number; neutral: boolean }[] = [
  { name: "WM 2022", league: 1, season: 2022, weight: 2.5, neutral: true },
  { name: "EM 2024", league: 4, season: 2024, weight: 2.5, neutral: true },
  { name: "Nations League 2024", league: 5, season: 2024, weight: 2.0, neutral: false },
  { name: "Nations League 2022", league: 5, season: 2022, weight: 2.0, neutral: false },
  { name: "Copa America 2024", league: 9, season: 2024, weight: 2.5, neutral: true },
  { name: "Afrika-Cup 2023", league: 6, season: 2023, weight: 2.5, neutral: true },
  // Freundschaftsspiele: breite Abdeckung nicht-europäischer Teams (geringeres Gewicht).
  { name: "Freundschaftsspiele 2024", league: 10, season: 2024, weight: 1.0, neutral: false },
  { name: "Freundschaftsspiele 2023", league: 10, season: 2023, weight: 1.0, neutral: false },
  { name: "Freundschaftsspiele 2022", league: 10, season: 2022, weight: 1.0, neutral: false },
];

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[^a-z]/g, "");

async function main() {
  const elo = new EloModel();
  const allMatches: EloMatch[] = [];

  console.log("Lade historische Länderspiele …");
  for (const h of HISTORY) {
    let fixtures;
    try {
      fixtures = await fetchFixtures(h.league, h.season);
    } catch (e) {
      console.log(`  ${h.name}: nicht verfügbar (${(e as Error).message.slice(0, 40)})`);
      continue;
    }
    let n = 0;
    for (const f of fixtures) {
      if (!isFinished(f.fixture.status.short) || f.goals.home == null || f.goals.away == null) continue;
      allMatches.push({
        homeTeam: f.teams.home.name,
        awayTeam: f.teams.away.name,
        homeGoals: f.goals.home,
        awayGoals: f.goals.away,
        date: new Date(f.fixture.date),
        weight: h.weight,
        neutral: h.neutral,
      });
      n++;
    }
    console.log(`  ${h.name}: ${n} Spiele`);
  }
  elo.train(allMatches);

  console.log(`\nTop 16 Nationalmannschaften (Elo):`);
  for (const r of elo.ranking().slice(0, 16)) console.log(`  ${r.rating}  ${r.team}`);

  // Elo-Index für Namensabgleich mit der Odds API.
  const eloByNorm = new Map(elo.knownTeams().map((t) => [norm(t), t] as const));

  console.log(`\nWM-Spiele mit Quoten (The Odds API):`);
  const events = await fetchOdds("soccer_fifa_world_cup");
  if (events.length === 0) {
    console.log("  aktuell keine WM-Spiele mit Quoten.");
    return;
  }

  const value: { line: string; edge: number }[] = [];
  for (const ev of events) {
    const three = bestThreeWay(ev);
    if (!three) continue;
    const homeName = eloByNorm.get(norm(ev.home_team)) ?? ev.home_team;
    const awayName = eloByNorm.get(norm(ev.away_team)) ?? ev.away_team;
    const rH = elo.rating(homeName), rA = elo.rating(awayName);
    const gH = elo.games(homeName), gA = elo.games(awayName);
    const { expHomeGoals, expAwayGoals } = elo.expectedGoals(homeName, awayName, true);
    const probs = matchProbabilities(expHomeGoals, expAwayGoals);

    const MIN_GAMES = 8;
    const reliable = gH >= MIN_GAMES && gA >= MIN_GAMES;
    console.log(
      `\n  ${ev.home_team} (Elo ${Math.round(rH)}, ${gH} Sp.) vs ${ev.away_team} (Elo ${Math.round(rA)}, ${gA} Sp.)` +
        (reliable ? "" : "  ⚠ zu wenig Daten – keine Wertung")
    );
    console.log(
      `    Modell: ${(probs.pHome * 100).toFixed(0)}% / ${(probs.pDraw * 100).toFixed(0)}% / ${(probs.pAway * 100).toFixed(0)}%` +
        ` | Quote: ${three.home} / ${three.draw} / ${three.away}`
    );
    if (!reliable) continue;
    const MAX_EDGE = 0.4; // darüber: fast immer Modellfehler statt Value
    for (const c of findValue(probs, three, { minOdds: 1.8, minEdge: 0.05 }).filter((c) => c.edge <= MAX_EDGE)) {
      const sel = c.selection === "HOME" ? ev.home_team : c.selection === "AWAY" ? ev.away_team : "Unentschieden";
      console.log(`    → VALUE: ${sel} @ ${c.odds} (Modell ${(c.modelProb * 100).toFixed(0)}%, Vorteil +${(c.edge * 100).toFixed(1)}%)`);
      value.push({ line: `${sel} (${ev.home_team} vs ${ev.away_team})`, edge: c.edge });
    }
  }

  console.log(`\n=== ${value.length} Value-Wetten gefunden ===`);
}

main().catch((e) => { console.error(e); process.exit(1); });
