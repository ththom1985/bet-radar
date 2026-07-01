// Poisson-Modell für Fußball-Ergebnisse.
//
// Grundidee: Die Anzahl Tore, die eine Mannschaft in einem Spiel erzielt, folgt
// näherungsweise einer Poisson-Verteilung mit Erwartungswert λ (lambda).
// Kennt man λ_home und λ_away, kann man die Wahrscheinlichkeit jedes Ergebnisses
// (0:0, 1:0, 2:1, ...) berechnen und daraus 1X2 (Heim/Remis/Auswärts) ableiten.

/** Poisson-Wahrscheinlichkeit für genau k Tore bei Erwartungswert lambda. */
export function poissonProbability(k: number, lambda: number): number {
  if (lambda <= 0) return k === 0 ? 1 : 0;
  return (Math.exp(-lambda) * Math.pow(lambda, k)) / factorial(k);
}

function factorial(n: number): number {
  let result = 1;
  for (let i = 2; i <= n; i++) result *= i;
  return result;
}

export type MatchProbabilities = {
  pHome: number;
  pDraw: number;
  pAway: number;
  /** Wahrscheinlichste Einzelergebnisse, absteigend sortiert. */
  topScores: { home: number; away: number; prob: number }[];
};

/**
 * Berechnet 1X2-Wahrscheinlichkeiten aus den erwarteten Toren beider Teams.
 * @param maxGoals Obergrenze der betrachteten Tore je Team (10 deckt >99,9% ab).
 */
export function matchProbabilities(
  expHomeGoals: number,
  expAwayGoals: number,
  maxGoals = 10
): MatchProbabilities {
  let pHome = 0;
  let pDraw = 0;
  let pAway = 0;
  const scores: { home: number; away: number; prob: number }[] = [];

  const homeProbs = Array.from({ length: maxGoals + 1 }, (_, i) =>
    poissonProbability(i, expHomeGoals)
  );
  const awayProbs = Array.from({ length: maxGoals + 1 }, (_, j) =>
    poissonProbability(j, expAwayGoals)
  );

  for (let i = 0; i <= maxGoals; i++) {
    for (let j = 0; j <= maxGoals; j++) {
      const p = homeProbs[i] * awayProbs[j];
      scores.push({ home: i, away: j, prob: p });
      if (i > j) pHome += p;
      else if (i === j) pDraw += p;
      else pAway += p;
    }
  }

  // Auf Summe 1 normieren (die abgeschnittenen hohen Tore fehlen minimal).
  const total = pHome + pDraw + pAway;
  pHome /= total;
  pDraw /= total;
  pAway /= total;

  const topScores = scores.sort((a, b) => b.prob - a.prob).slice(0, 5);

  return { pHome, pDraw, pAway, topScores };
}
