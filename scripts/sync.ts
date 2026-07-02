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
import { fetchFixtures } from "../lib/clients/apiFootball";
import { fetchOdds, bestThreeWay, normalizeName } from "../lib/clients/oddsApi";
import { getBundesligaMatches } from "../lib/clients/openligadb";
import { getMatches as getFdMatches, FD_CODES } from "../lib/clients/footballDataOrg";
import { normalizeClub } from "../lib/clubs";
import { runPredictions } from "../lib/predict";

const prisma = new PrismaClient();

const HISTORY_SEASON = 2024; // neueste im API-Football-Free-Tier verfügbare Saison
const CURRENT_SEASON = 2025; // aktuelle BL-Saison via OpenLigaDB (nicht saison-gesperrt)

// --- Teams aus API-Football anlegen (für apiFootballId → Trainer) ---
// Die 2024er-Fixtures speichern wir NICHT: Team-Stärken kommen aus der aktuellen Saison.
// Nur eindeutige Teams anlegen (statt pro Spiel) spart tausende Schreibvorgänge.
async function syncHistoryTeams(leagueId: number, apiLeagueId: number) {
  const fixtures = await fetchFixtures(apiLeagueId, HISTORY_SEASON);
  const seen = new Map<number, string>();
  for (const f of fixtures) {
    seen.set(f.teams.home.id, f.teams.home.name);
    seen.set(f.teams.away.id, f.teams.away.name);
  }
  for (const [apiId, name] of seen) await upsertTeamByApiId(apiId, name, leagueId);
  return seen.size;
}

async function upsertTeamByApiId(apiId: number, name: string, leagueId: number): Promise<number> {
  const team = await prisma.team.upsert({
    where: { apiFootballId: apiId },
    create: { apiFootballId: apiId, name, leagueId },
    update: { name },
  });
  return team.id;
}

// --- Aktuelle Saison (25/26) importieren ---
// Bundesliga ← OpenLigaDB (mit Torschützen), übrige 4 Ligen ← football-data.org.
// Beide gratis und NICHT saison-gesperrt → aktuelle Team-Stärken statt 2024er-Daten.
type SimpleMatch = {
  homeTeam: string;
  awayTeam: string;
  homeGoals: number;
  awayGoals: number;
  date: Date;
  extId: string;
};

async function currentSeasonMatches(leagueName: string): Promise<SimpleMatch[]> {
  if (leagueName === "Bundesliga") {
    const m = (await getBundesligaMatches(CURRENT_SEASON)).filter((x) => x.finished);
    return m.map((x) => ({ ...x, extId: `old:${x.id}` }));
  }
  const code = FD_CODES[leagueName];
  if (!code) return [];
  const m = (await getFdMatches(code, CURRENT_SEASON)).filter((x) => x.finished);
  return m.map((x) => ({ ...x, extId: `fd:${x.id}` }));
}

async function importCurrentSeason(leagueId: number, matches: SimpleMatch[]) {
  // Bestehende Teams (aus API-Football-Historie) per Vereinsname zuordnen,
  // damit die apiFootballId (für Trainer-Abruf) erhalten bleibt.
  const teams = await prisma.team.findMany({ where: { leagueId } });
  const index = new Map<string, number>();
  for (const t of teams) index.set(normalizeClub(t.name), t.id);

  async function resolveTeam(name: string): Promise<number> {
    const norm = normalizeClub(name);
    if (index.has(norm)) return index.get(norm)!;
    // Fallback: enthält-Vergleich (z.B. "lyon" ⊂ "lyonnais", "tottenham" ⊂ "tottenhamhotspur").
    for (const [key, id] of index) {
      if (key.length >= 4 && (key.includes(norm) || norm.includes(key))) return id;
    }
    const created = await prisma.team.create({ data: { name, leagueId } });
    index.set(norm, created.id);
    return created.id;
  }

  // Team-IDs auflösen (meist In-Memory), dann Fixtures gebündelt einfügen (1 Roundtrip).
  const rows = [];
  for (const m of matches) {
    const homeTeamId = await resolveTeam(m.homeTeam);
    const awayTeamId = await resolveTeam(m.awayTeam);
    rows.push({
      oddsEventId: m.extId,
      leagueId,
      homeTeamId,
      awayTeamId,
      kickoff: m.date,
      season: CURRENT_SEASON,
      round: "Saison 25/26",
      status: "FINISHED",
      homeGoals: m.homeGoals,
      awayGoals: m.awayGoals,
    });
  }
  const res = await prisma.fixture.createMany({ data: rows, skipDuplicates: true });
  return res.count;
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
  const seenPairs = new Set<string>(); // gegen doppelte Listings der Odds-API (Saisonstart)
  for (const ev of events) {
    const three = bestThreeWay(ev);
    if (!three) {
      unmatched.push(`${ev.home_team} vs ${ev.away_team} (keine Quoten)`);
      continue;
    }
    const pairKey = `${normalizeClub(ev.home_team)}|${normalizeClub(ev.away_team)}`;
    if (seenPairs.has(pairKey)) continue; // dieselbe Paarung schon verarbeitet
    seenPairs.add(pairKey);
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

      // Teams aus API-Football (für Trainer-IDs) — Ausfall (z.B. Tageslimit) darf
      // den Rest NICHT abbrechen; Teams entstehen sonst über die aktuelle Saison/Quoten.
      let teamCount = 0;
      try {
        teamCount = await syncHistoryTeams(league.id, cfg.apiFootballId);
      } catch (e) {
        console.log(`   API-Football-Teams übersprungen: ${(e as Error).message.slice(0, 45)}`);
      }
      // Aktuelle Saison 25/26 (BL ← OpenLigaDB, sonst ← football-data.org).
      let current = 0;
      try {
        const cm = await currentSeasonMatches(cfg.name);
        if (cm.length) current = await importCurrentSeason(league.id, cm);
      } catch (e) {
        console.log(`   Aktuell-Import fehlgeschlagen: ${(e as Error).message.slice(0, 50)}`);
      }
      const odds = await syncUpcomingFromOdds(league.id, cfg.oddsApiKey);
      console.log(
        `${cfg.name}: ${teamCount} Teams` +
          (current ? ` · aktuell ${current} Erg. (25/26)` : "") +
          ` · anstehend ${odds.matched}/${odds.events} mit Quoten`
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
