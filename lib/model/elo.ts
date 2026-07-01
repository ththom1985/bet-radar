// Elo-Bewertung für Mannschaften auf EINER gemeinsamen Skala.
// Nötig für Wettbewerbe, in denen Teams aus verschiedenen "Ligen" aufeinandertreffen
// (Nationalmannschaften: WM/EM/Nations League; später auch CL/EL).
//
// Standard-Fußball-Elo (World-Football-Elo-Stil) mit Tordifferenz-Gewichtung.

export type EloMatch = {
  homeTeam: string;
  awayTeam: string;
  homeGoals: number;
  awayGoals: number;
  date: Date;
  weight: number; // K-Faktor-Gewicht: WM/EM hoch, Freundschaftsspiel niedrig
  neutral?: boolean;
};

const START = 1500;
const HOME_ADV = 60; // Elo-Bonus für Heimrecht (bei neutral = 0)

function expectedScore(drWithHome: number): number {
  return 1 / (1 + Math.pow(10, -drWithHome / 400));
}

// Tordifferenz-Multiplikator (höherer Sieg = stärkeres Update).
function goalMultiplier(goalDiff: number): number {
  const d = Math.abs(goalDiff);
  if (d <= 1) return 1;
  if (d === 2) return 1.5;
  return (11 + d) / 8;
}

export class EloModel {
  private ratings = new Map<string, number>();
  private counts = new Map<string, number>();

  rating(team: string): number {
    return this.ratings.get(team) ?? START;
  }

  /** Anzahl Spiele, mit denen die Bewertung dieses Teams gebildet wurde. */
  games(team: string): number {
    return this.counts.get(team) ?? 0;
  }

  /** Verarbeitet Spiele in CHRONOLOGISCHER Reihenfolge und aktualisiert die Bewertungen. */
  train(matches: EloMatch[]) {
    const sorted = [...matches].sort((a, b) => a.date.getTime() - b.date.getTime());
    for (const m of sorted) {
      const rH = this.rating(m.homeTeam);
      const rA = this.rating(m.awayTeam);
      const ha = m.neutral ? 0 : HOME_ADV;
      const we = expectedScore(rH - rA + ha);
      const w = m.homeGoals > m.awayGoals ? 1 : m.homeGoals === m.awayGoals ? 0.5 : 0;
      const k = 20 * m.weight;
      const delta = k * goalMultiplier(m.homeGoals - m.awayGoals) * (w - we);
      this.ratings.set(m.homeTeam, rH + delta);
      this.ratings.set(m.awayTeam, rA - delta);
      this.counts.set(m.homeTeam, this.games(m.homeTeam) + 1);
      this.counts.set(m.awayTeam, this.games(m.awayTeam) + 1);
    }
  }

  /** Rangliste (stärkste zuerst). */
  ranking(): { team: string; rating: number }[] {
    return [...this.ratings.entries()]
      .map(([team, rating]) => ({ team, rating: Math.round(rating) }))
      .sort((a, b) => b.rating - a.rating);
  }

  /**
   * Erwartete Tore beider Teams aus der Elo-Differenz — damit lässt sich das
   * bestehende Poisson-Modell (matchProbabilities) für 1X2 weiterverwenden.
   */
  expectedGoals(home: string, away: string, neutral = true): { expHomeGoals: number; expAwayGoals: number } {
    const dr = this.rating(home) - this.rating(away) + (neutral ? 0 : HOME_ADV);
    const supremacy = dr / 150; // ~150 Elo ≈ 1 Tor Unterschied
    const base = 1.35; // Ø Tore je Team im internationalen Spiel
    return {
      expHomeGoals: Math.max(0.15, base + supremacy / 2),
      expAwayGoals: Math.max(0.15, base - supremacy / 2),
    };
  }

  knownTeams(): string[] {
    return [...this.ratings.keys()];
  }
}
