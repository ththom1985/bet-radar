// Hilfsfunktionen rund um Quoten.
//
// Eine Dezimalquote von 2.0 bedeutet: 50% implizite Wahrscheinlichkeit (1/2.0).
// Die Summe der impliziten Wahrscheinlichkeiten aller Ausgänge liegt über 100% —
// die Differenz ist die Marge des Buchmachers (der "Overround").

export type ThreeWayOdds = {
  home: number;
  draw: number;
  away: number;
};

/** Implizite Wahrscheinlichkeit einer einzelnen Quote (inkl. Marge). */
export function impliedProbability(odds: number): number {
  return odds > 0 ? 1 / odds : 0;
}

/** Marge (Overround) eines 1X2-Marktes, z.B. 0.06 = 6%. */
export function margin(odds: ThreeWayOdds): number {
  return 1 / odds.home + 1 / odds.draw + 1 / odds.away - 1;
}

/**
 * "Faire" Wahrscheinlichkeiten ohne Marge (proportional normiert).
 * Nützlich, um das eigene Modell mit der echten Einschätzung des Marktes zu
 * vergleichen — nicht für die EV-Berechnung (die nutzt die echte Quote).
 */
export function fairProbabilities(odds: ThreeWayOdds): ThreeWayOdds {
  const raw = {
    home: 1 / odds.home,
    draw: 1 / odds.draw,
    away: 1 / odds.away,
  };
  const sum = raw.home + raw.draw + raw.away;
  return { home: raw.home / sum, draw: raw.draw / sum, away: raw.away / sum };
}
