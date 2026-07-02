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
import { impliedProbability, fairProbabilities } from "../odds";

// Shrinkage zum Markt: der Buchmacher ist besser kalibriert als unser Modell.
// Wir mischen Marktmeinung + Modell → nur wo das Modell STARK & plausibel abweicht,
// bleibt Value übrig (killt überhebliche Außenseiter-"Values").
const MARKET_WEIGHT = 0.6;
// Mindest-Gewinnwahrscheinlichkeit: keine reinen Lotto-Tipps (die Chance muss vernünftig sein).
const MIN_MODEL_PROB = 0.33;

const blendToMarket = (model: number, marketFair: number) =>
  MARKET_WEIGHT * marketFair + (1 - MARKET_WEIGHT) * model;

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

  const fair = fairProbabilities(odds); // faire Marktwahrscheinlichkeiten (ohne Marge)
  const base: { selection: Selection; modelProb: number; odds: number }[] = [
    { selection: "HOME", modelProb: blendToMarket(probs.pHome, fair.home), odds: odds.home },
    { selection: "DRAW", modelProb: blendToMarket(probs.pDraw, fair.draw), odds: odds.draw },
    { selection: "AWAY", modelProb: blendToMarket(probs.pAway, fair.away), odds: odds.away },
  ];
  const rows: ValueCandidate[] = base.map(({ selection, modelProb, odds }) => ({
    selection,
    modelProb,
    odds,
    impliedProb: impliedProbability(odds),
    edge: modelProb * odds - 1,
  }));

  return rows
    .filter((r) => r.odds >= minOdds && r.edge >= minEdge && r.modelProb >= MIN_MODEL_PROB)
    .sort((a, b) => b.edge - a.edge);
}

/** Value bei 2-Wege-Märkten (z.B. Tennis: nur Sieg Spieler A / Spieler B). */
export function findValueTwoWay(
  pHome: number,
  pAway: number,
  oddsHome: number,
  oddsAway: number,
  opts: ValueOptions = {}
): ValueCandidate[] {
  const minOdds = opts.minOdds ?? 1.8;
  const minEdge = opts.minEdge ?? 0.05;
  // Faire Marktwahrscheinlichkeiten (2-Wege, Marge entfernt) → Shrinkage.
  const rh = 1 / oddsHome;
  const ra = 1 / oddsAway;
  const sum = rh + ra;
  const base: { selection: Selection; modelProb: number; odds: number }[] = [
    { selection: "HOME", modelProb: blendToMarket(pHome, rh / sum), odds: oddsHome },
    { selection: "AWAY", modelProb: blendToMarket(pAway, ra / sum), odds: oddsAway },
  ];
  return base
    .map(({ selection, modelProb, odds }) => ({
      selection,
      modelProb,
      odds,
      impliedProb: impliedProbability(odds),
      edge: modelProb * odds - 1,
    }))
    .filter((r) => r.odds >= minOdds && r.edge >= minEdge && r.modelProb >= MIN_MODEL_PROB)
    .sort((a, b) => b.edge - a.edge);
}
