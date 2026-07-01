// Value-Erkennung: Vergleicht die Modell-Wahrscheinlichkeit mit der Quote.
//
// Erwarteter Wert (Edge) einer Wette:
//   edge = modelProb × quote − 1
// > 0  → das Modell hält die Wette für profitabel (positiver Erwartungswert).
//        Beispiel: Modell sagt 60% (0.6), Quote 1.90 → 0.6 × 1.90 − 1 = +0.14 (+14%).
//
// WICHTIG: Ein positiver Edge heißt NICHT "sichere Wette". Er heißt nur, dass
// das Modell optimistischer ist als der Buchmacher. Ob das Modell recht hat,
// zeigt erst die langfristige Auswertung über viele Wetten.

import type { MatchProbabilities } from "./poisson";
import type { ThreeWayOdds } from "../odds";
import { impliedProbability } from "../odds";

export type Selection = "HOME" | "DRAW" | "AWAY";

export type ValueCandidate = {
  selection: Selection;
  modelProb: number;
  odds: number;
  impliedProb: number;
  edge: number;
};

export type ValueOptions = {
  /** Mindestquote, z.B. 1.8. */
  minOdds?: number;
  /** Mindest-Edge, z.B. 0.05 = 5% erwarteter Vorteil. */
  minEdge?: number;
};

/**
 * Ermittelt für ein Spiel die Value-Kandidaten (je Ausgang), die die
 * Mindestquote und den Mindest-Edge erfüllen. Sortiert nach Edge absteigend.
 */
export function findValue(
  probs: MatchProbabilities,
  odds: ThreeWayOdds,
  opts: ValueOptions = {}
): ValueCandidate[] {
  const minOdds = opts.minOdds ?? 1.8;
  const minEdge = opts.minEdge ?? 0.05;

  const base: { selection: Selection; modelProb: number; odds: number }[] = [
    { selection: "HOME", modelProb: probs.pHome, odds: odds.home },
    { selection: "DRAW", modelProb: probs.pDraw, odds: odds.draw },
    { selection: "AWAY", modelProb: probs.pAway, odds: odds.away },
  ];
  const rows: ValueCandidate[] = base.map(({ selection, modelProb, odds }) => ({
    selection,
    modelProb,
    odds,
    impliedProb: impliedProbability(odds),
    edge: modelProb * odds - 1,
  }));

  return rows
    .filter((r) => r.odds >= minOdds && r.edge >= minEdge)
    .sort((a, b) => b.edge - a.edge);
}
