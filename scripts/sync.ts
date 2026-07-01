// Echter Datenabgleich (an Free-Tier angepasst):
//   Historie  ← API-Football, Saison 2024 (Free-Tier gibt nur 2022–2024 frei)
//              → Team-Stärken fürs Modell
//   Anstehend ← The Odds API (liefert kommende Spiele + Quoten)
//              → dagegen rechnet das Modell
//
// Aufruf:  npm run sync
// Free-Tier schonen: möglichst nur 1×/Tag laufen lassen.

import { PrismaClient } from "@prisma/client";
import { LEAGUES } from "../lib/leagues";
import { fetchFixtures, isFinished } from "../lib/clients/apiFootball";
import { fetchOdds, bestThreeWay, normalizeName } from "../lib/clients/oddsApi";
import { runPredictions } from "../lib/predict";

const prisma = new PrismaClient();

const HISTORY_SEASON = 2024; // neueste im Free-Tier verfügbare Saison

// --- Historie aus API-Football ---
async function syncHistory(leagueId: number, apiLeagueId: number) {
  const fixtures = await fetchFixtures(apiLeagueId, HISTORY_SEASON);
  let finished = 0;
  for (const f of fixtures) {
    if (!isFinished(f.fixture.status.short)) continue;
    const homeId = await upsertTeamByApiId(f.teams.home.id, f.teams.home.name, leagueId);
    const awayId = await upsertTeamByApiId(f.teams.away.id, f.teams.away.name, leagueId);
    await prisma.fixture.upsert({
      where: { apiFootballId: f.fixture.id },
      create: {
        apiFootballId: f.fixture.id,
        leagueId,
        homeTeamId: homeId,
        awayTeamId: awayId,
        kickoff: new Date(f.fixture.date),
        season: HISTORY_SEASON,
        round: f.league.round,
        status: "FINISHED",
        homeGoals: f.goals.home,
        awayGoals: f.goals.away,
      },
      update: {
        homeGoals: f.goals.home,
        awayGoals: f.goals.away,
        status: "FINISHED",
      },
    });
    finished++;
  }
  return finished;
}

async function upsertTeamByApiId(apiId: number, name: string, leagueId: number): Promise<number> {
  const team = await prisma.team.upsert({
    where: { apiFootballId: apiId },
    create: { apiFootballId: apiId, name, leagueId },
    update: { name },
  });
  return team.id;
}

// --- Anstehende Spiele + Quoten aus The Odds API ---
async function syncUpcomingFromOdds(leagueId: number, sportKey: string) {
  const events = await fetchOdds(sportKey);

  // Namens-Index aller bekannten Teams dieser Liga (aus der Historie).
  const teams = await prisma.team.findMany({ where: { leagueId } });
  const index = new Map<string, number>();
  for (const t of teams) index.set(normalizeName(t.name), t.id);

  // Team per Name auflösen; unbekannte Teams (z.B. Aufsteiger) neu anlegen.
  async function resolveTeam(name: string): Promise<number> {
    const norm = normalizeName(name);
    if (index.has(norm)) return index.get(norm)!;
    // Fallback: enthält-Vergleich (z.B. "inter" ⊂ "intermailand").
    for (const [key, id] of index) {
      if (key.length >= 4 && (key.includes(norm) || norm.includes(key))) return id;
    }
    const created = await prisma.team.create({ data: { name, leagueId } });
    index.set(norm, created.id);
    return created.id;
  }

  let matched = 0;
  const unmatched: string[] = [];
  for (const ev of events) {
    const three = bestThreeWay(ev);
    if (!three) {
      unmatched.push(`${ev.home_team} vs ${ev.away_team} (keine Quoten)`);
      continue;
    }
    const homeId = await resolveTeam(ev.home_team);
    const awayId = await resolveTeam(ev.away_team);

    const fx = await prisma.fixture.upsert({
      where: { oddsEventId: ev.id },
      create: {
        oddsEventId: ev.id,
        leagueId,
        homeTeamId: homeId,
        awayTeamId: awayId,
        kickoff: new Date(ev.commence_time),
        season: HISTORY_SEASON + 1,
        round: "Anstehend",
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
    matched++;
  }
  return { events: events.length, matched, unmatched };
}

async function main() {
  if (!process.env.API_FOOTBALL_KEY || !process.env.ODDS_API_KEY) {
    console.error("\n⚠️  API-Keys fehlen in .env. Nutze vorerst:  npm run seed\n");
    process.exit(1);
  }

  // Demo-Daten (aus dem Seed) einmalig entfernen, damit nichts Simuliertes übrig bleibt.
  await prisma.oddsSnapshot.deleteMany();
  await prisma.valueBet.deleteMany();
  await prisma.prediction.deleteMany();
  await prisma.fixture.deleteMany();
  await prisma.team.deleteMany();

  for (const cfg of LEAGUES) {
    try {
      const league = await prisma.league.upsert({
        where: { apiFootballId: cfg.apiFootballId },
        create: {
          name: cfg.name,
          country: cfg.country,
          apiFootballId: cfg.apiFootballId,
          oddsApiKey: cfg.oddsApiKey,
          season: HISTORY_SEASON,
        },
        update: {},
      });

      const finished = await syncHistory(league.id, cfg.apiFootballId);
      const odds = await syncUpcomingFromOdds(league.id, cfg.oddsApiKey);
      console.log(
        `${cfg.name}: Historie ${finished} Erg. · anstehend ${odds.matched}/${odds.events} mit Quoten`
      );
      if (odds.unmatched.length) {
        console.log(`   ohne Quoten/Zuordnung: ${odds.unmatched.slice(0, 5).join("; ")}`);
      }
    } catch (e) {
      console.error(`${cfg.name}: Fehler – ${(e as Error).message}`);
    }
  }

  console.log("\nRechne Modell …");
  const r = await runPredictions();
  console.log(`Vorhersagen: ${r.predicted}, Value-Wetten: ${r.valueCount}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
