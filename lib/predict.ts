// Orchestrierung: Modell über die Datenbank laufen lassen.
// Für jede Liga: Stärken aus beendeten Spielen berechnen, anstehende Spiele
// vorhersagen, Vorhersagen + Value-Wetten speichern.

import { prisma } from "./prisma";
import { computeStrengths, expectedGoals } from "./model/strengths";
import { matchProbabilities } from "./model/poisson";
import { findValue } from "./model/value";

const MODEL_NAME = "poisson-v1";
const MIN_ODDS = 1.8;
const MIN_EDGE = 0.05;
// Mindest-Historie je Team, damit die Stärke verlässlich ist. Teams ohne genug
// beendete Spiele (Aufsteiger, Pokal-/Testspiel-Gegner) bekommen sonst neutrale
// Durchschnittsstärke → absurde Scheinvorteile. Solche Spiele bewerten wir nicht.
const MIN_HISTORY = 10;
// Obergrenze: Edges jenseits davon deuten fast immer auf Datenfehler statt Value.
const MAX_PLAUSIBLE_EDGE = 0.4;

export async function runPredictions() {
  const leagues = await prisma.league.findMany();
  let predicted = 0;
  let valueCount = 0;

  for (const league of leagues) {
    // Stärken aus der NEUESTEN verfügbaren Saison (z.B. Bundesliga 25/26 via OpenLigaDB
    // statt der älteren 2024er-Daten).
    const latest = await prisma.fixture.aggregate({
      where: { leagueId: league.id, status: "FINISHED", homeGoals: { not: null } },
      _max: { season: true },
    });
    const strengthSeason = latest._max.season ?? undefined;

    const finished = await prisma.fixture.findMany({
      where: { leagueId: league.id, status: "FINISHED", homeGoals: { not: null }, season: strengthSeason },
      select: { homeTeamId: true, awayTeamId: true, homeGoals: true, awayGoals: true },
    });

    const strengths = computeStrengths(
      finished.map((f) => ({
        homeTeamId: f.homeTeamId,
        awayTeamId: f.awayTeamId,
        homeGoals: f.homeGoals!,
        awayGoals: f.awayGoals!,
      }))
    );

    const upcoming = await prisma.fixture.findMany({
      where: { leagueId: league.id, status: "SCHEDULED" },
      include: { odds: { orderBy: { fetchedAt: "desc" } } },
    });

    for (const fx of upcoming) {
      const { expHomeGoals, expAwayGoals } = expectedGoals(strengths, fx.homeTeamId, fx.awayTeamId);
      const probs = matchProbabilities(expHomeGoals, expAwayGoals);

      // Verlässlichkeit: beide Teams brauchen genug Historie, sonst keine Value-Wertung.
      const homeS = strengths.teams.get(fx.homeTeamId);
      const awayS = strengths.teams.get(fx.awayTeamId);
      const reliable =
        !!homeS &&
        !!awayS &&
        homeS.matchesHome + homeS.matchesAway >= MIN_HISTORY &&
        awayS.matchesHome + awayS.matchesAway >= MIN_HISTORY;

      await prisma.prediction.upsert({
        where: { fixtureId_model: { fixtureId: fx.id, model: MODEL_NAME } },
        create: {
          fixtureId: fx.id,
          model: MODEL_NAME,
          expHomeGoals,
          expAwayGoals,
          pHome: probs.pHome,
          pDraw: probs.pDraw,
          pAway: probs.pAway,
        },
        update: {
          expHomeGoals,
          expAwayGoals,
          pHome: probs.pHome,
          pDraw: probs.pDraw,
          pAway: probs.pAway,
        },
      });
      predicted++;

      // Alte Value-Wetten dieses Spiels immer erst entfernen.
      await prisma.valueBet.deleteMany({ where: { fixtureId: fx.id } });

      // Value nur bei verlässlicher Datenlage werten.
      if (fx.odds.length > 0 && reliable) {
        const best = {
          home: Math.max(...fx.odds.map((o) => o.homeOdds)),
          draw: Math.max(...fx.odds.map((o) => o.drawOdds)),
          away: Math.max(...fx.odds.map((o) => o.awayOdds)),
        };
        const bookmakerFor = (sel: "HOME" | "DRAW" | "AWAY", odds: number) =>
          fx.odds.find(
            (o) =>
              (sel === "HOME" && o.homeOdds === odds) ||
              (sel === "DRAW" && o.drawOdds === odds) ||
              (sel === "AWAY" && o.awayOdds === odds)
          )?.bookmaker ?? "?";

        const candidates = findValue(probs, best, { minOdds: MIN_ODDS, minEdge: MIN_EDGE })
          // Unplausibel hohe Edges aussortieren (Datenfehler statt Value).
          .filter((c) => c.edge <= MAX_PLAUSIBLE_EDGE);

        for (const c of candidates) {
          await prisma.valueBet.create({
            data: {
              fixtureId: fx.id,
              selection: c.selection,
              modelProb: c.modelProb,
              bestOdds: c.odds,
              impliedProb: c.impliedProb,
              edge: c.edge,
              bookmaker: bookmakerFor(c.selection, c.odds),
            },
          });
          valueCount++;
        }
      }
    }
  }

  return { predicted, valueCount };
}
