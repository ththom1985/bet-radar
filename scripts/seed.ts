// Demo-Seed: erzeugt für jede Liga echte Vereine, eine simulierte abgeschlossene
// Saison (für das Modell) und anstehende Spiele mit Demo-Quoten.
// Wird später durch echten API-Abgleich ersetzt. Reproduzierbar (fester Zufalls-Seed).

import { PrismaClient } from "@prisma/client";
import { LEAGUES, DEFAULT_SEASON } from "../lib/leagues";

const prisma = new PrismaClient();

// 12 bekannte Vereine je Liga (Auszug — echter Abgleich ergänzt/ersetzt).
const CLUBS: Record<string, string[]> = {
  Bundesliga: [
    "Bayern München", "Borussia Dortmund", "RB Leipzig", "Bayer Leverkusen",
    "VfB Stuttgart", "Eintracht Frankfurt", "SC Freiburg", "VfL Wolfsburg",
    "Borussia Mönchengladbach", "1. FC Union Berlin", "Werder Bremen", "FC Augsburg",
  ],
  "Premier League": [
    "Manchester City", "Arsenal", "Liverpool", "Manchester United",
    "Chelsea", "Tottenham Hotspur", "Newcastle United", "Aston Villa",
    "Brighton", "West Ham United", "Everton", "Wolverhampton",
  ],
  "La Liga": [
    "Real Madrid", "FC Barcelona", "Atlético Madrid", "Girona",
    "Athletic Bilbao", "Real Sociedad", "Real Betis", "Villarreal",
    "Valencia", "Sevilla", "Osasuna", "Celta Vigo",
  ],
  "Serie A": [
    "Inter Mailand", "AC Mailand", "Juventus Turin", "Atalanta Bergamo",
    "SSC Neapel", "AS Rom", "Lazio Rom", "AC Florenz",
    "Bologna", "Turin", "Udinese", "Genua",
  ],
  "Ligue 1": [
    "Paris Saint-Germain", "AS Monaco", "Olympique Marseille", "Lille",
    "Olympique Lyon", "Nizza", "Lens", "Stade Rennes",
    "Stade Reims", "Straßburg", "Nantes", "Montpellier",
  ],
};

// --- Reproduzierbarer Zufall (mulberry32) ---
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(42);

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// Latente "wahre" Stärke je Verein (nur für die Simulation).
type Latent = { attack: number; defense: number };
function latentFor(name: string): Latent {
  const r = mulberry32(hashString(name));
  // attack/defense um 1.0 herum; Topklubs bekommen leichten Bonus über den Index.
  const a = 0.8 + r() * 0.9; // 0.8 – 1.7
  const d = 0.8 + r() * 0.9;
  return { attack: a, defense: d };
}

// Poisson-Stichprobe (Knuth).
function samplePoisson(lambda: number): number {
  const L = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= rand();
  } while (p > L);
  return k - 1;
}

const HOME_ADV = 1.35; // Heimvorteil-Faktor
const BASE_GOALS = 1.15; // Grundtorrate

async function main() {
  console.log("Lösche alte Daten …");
  await prisma.valueBet.deleteMany();
  await prisma.prediction.deleteMany();
  await prisma.oddsSnapshot.deleteMany();
  await prisma.fixture.deleteMany();
  await prisma.team.deleteMany();
  await prisma.league.deleteMany();

  const now = new Date();

  for (const cfg of LEAGUES) {
    const league = await prisma.league.create({
      data: {
        name: cfg.name,
        country: cfg.country,
        apiFootballId: cfg.apiFootballId,
        oddsApiKey: cfg.oddsApiKey,
        season: DEFAULT_SEASON,
      },
    });

    const names = CLUBS[cfg.name];
    const teams = [];
    for (let i = 0; i < names.length; i++) {
      const t = await prisma.team.create({
        data: {
          name: names[i],
          // Deterministische Pseudo-ID, bis echter API-Abgleich läuft.
          apiFootballId: cfg.apiFootballId * 1000 + i,
          leagueId: league.id,
        },
      });
      teams.push(t);
    }

    const latent = new Map(names.map((n) => [n, latentFor(n)] as const));

    // --- Simulierte, abgeschlossene Saison: Doppel-Rundenturnier ---
    let dayOffset = -240; // ~8 Monate zurück
    let finished = 0;
    for (const home of teams) {
      for (const away of teams) {
        if (home.id === away.id) continue;
        const lh = latent.get(home.name)!;
        const la = latent.get(away.name)!;
        const lambdaHome = lh.attack * la.defense * BASE_GOALS * HOME_ADV;
        const lambdaAway = la.attack * lh.defense * BASE_GOALS;
        const hg = samplePoisson(lambdaHome);
        const ag = samplePoisson(lambdaAway);
        const kickoff = new Date(now);
        kickoff.setDate(kickoff.getDate() + dayOffset);
        dayOffset += 1;
        if (dayOffset > -30) dayOffset = -240; // im Fenster bleiben

        await prisma.fixture.create({
          data: {
            apiFootballId: 900000 + finished + cfg.apiFootballId * 10000,
            leagueId: league.id,
            homeTeamId: home.id,
            awayTeamId: away.id,
            kickoff,
            season: DEFAULT_SEASON,
            round: "Simulierte Saison",
            status: "FINISHED",
            homeGoals: hg,
            awayGoals: ag,
          },
        });
        finished++;
      }
    }

    // --- Anstehende Spiele mit Demo-Quoten (nächste 10 Tage) ---
    // 6 Paarungen; Quoten aus "wahrer" Wahrscheinlichkeit + Marge + Rauschen.
    const upcoming: [number, number][] = [
      [0, 1], [2, 3], [4, 5], [6, 7], [8, 9], [10, 11],
    ];
    let up = 0;
    for (const [hi, ai] of upcoming) {
      const home = teams[hi];
      const away = teams[ai];
      const lh = latent.get(home.name)!;
      const la = latent.get(away.name)!;
      const lambdaHome = lh.attack * la.defense * BASE_GOALS * HOME_ADV;
      const lambdaAway = la.attack * lh.defense * BASE_GOALS;

      // "Wahre" 1X2-Wahrscheinlichkeiten grob via kleiner Simulation.
      let h = 0, d = 0, a = 0;
      const sims = 4000;
      for (let s = 0; s < sims; s++) {
        const g1 = samplePoisson(lambdaHome);
        const g2 = samplePoisson(lambdaAway);
        if (g1 > g2) h++; else if (g1 === g2) d++; else a++;
      }
      h /= sims; d /= sims; a /= sims;

      // Quoten mit ~6% Marge und leichtem Rauschen (damit Value entstehen kann).
      const noise = () => 0.94 + rand() * 0.12; // ±6%
      const homeOdds = +(1 / (h * 1.06) * noise()).toFixed(2);
      const drawOdds = +(1 / (d * 1.06) * noise()).toFixed(2);
      const awayOdds = +(1 / (a * 1.06) * noise()).toFixed(2);

      const kickoff = new Date(now);
      kickoff.setDate(kickoff.getDate() + 2 + up);

      const fx = await prisma.fixture.create({
        data: {
          apiFootballId: 800000 + up + cfg.apiFootballId * 10000,
          leagueId: league.id,
          homeTeamId: home.id,
          awayTeamId: away.id,
          kickoff,
          season: DEFAULT_SEASON,
          round: "Anstehend",
          status: "SCHEDULED",
        },
      });
      await prisma.oddsSnapshot.create({
        data: {
          fixtureId: fx.id,
          bookmaker: "Demo-Buchmacher",
          homeOdds: Math.max(1.01, homeOdds),
          drawOdds: Math.max(1.01, drawOdds),
          awayOdds: Math.max(1.01, awayOdds),
        },
      });
      up++;
    }

    console.log(`  ${cfg.name}: ${teams.length} Teams, ${finished} Ergebnisse, ${up} anstehende Spiele`);
  }

  console.log("Seed fertig.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
