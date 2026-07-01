// Berechnet aus historischen Ergebnissen die Angriffs-/Abwehrstärke jeder
// Mannschaft — getrennt für Heim- und Auswärtsspiele — und daraus die
// erwarteten Tore (λ) für ein konkretes Spiel.
//
// Klassischer Ansatz (Basis für Dixon-Coles):
//   Angriffsstärke Heim = Ø erzielte Tore zuhause / Liga-Ø Heimtore
//   Abwehrstärke   Heim = Ø kassierte Tore zuhause / Liga-Ø Auswärtstore
//   λ_home = AngriffHeim(Heimteam) × AbwehrAuswärts(Gastteam) × Liga-Ø Heimtore
//   λ_away = AngriffAuswärts(Gastteam) × AbwehrHeim(Heimteam) × Liga-Ø Auswärtstore

export type FinishedMatch = {
  homeTeamId: number;
  awayTeamId: number;
  homeGoals: number;
  awayGoals: number;
};

export type TeamStrength = {
  teamId: number;
  homeAttack: number;
  homeDefense: number;
  awayAttack: number;
  awayDefense: number;
  matchesHome: number;
  matchesAway: number;
};

export type LeagueStrengths = {
  leagueHomeGoalAvg: number;
  leagueAwayGoalAvg: number;
  teams: Map<number, TeamStrength>;
};

/** Ermittelt Liga- und Team-Stärken aus allen beendeten Spielen einer Saison. */
export function computeStrengths(matches: FinishedMatch[]): LeagueStrengths {
  const n = matches.length;
  if (n === 0) {
    return { leagueHomeGoalAvg: 1.5, leagueAwayGoalAvg: 1.1, teams: new Map() };
  }

  const totalHome = matches.reduce((s, m) => s + m.homeGoals, 0);
  const totalAway = matches.reduce((s, m) => s + m.awayGoals, 0);
  const leagueHomeGoalAvg = totalHome / n;
  const leagueAwayGoalAvg = totalAway / n;

  // Roh-Summen je Team sammeln.
  type Acc = {
    homeScored: number;
    homeConceded: number;
    homeGames: number;
    awayScored: number;
    awayConceded: number;
    awayGames: number;
  };
  const acc = new Map<number, Acc>();
  const ensure = (id: number): Acc => {
    let a = acc.get(id);
    if (!a) {
      a = { homeScored: 0, homeConceded: 0, homeGames: 0, awayScored: 0, awayConceded: 0, awayGames: 0 };
      acc.set(id, a);
    }
    return a;
  };

  for (const m of matches) {
    const h = ensure(m.homeTeamId);
    h.homeScored += m.homeGoals;
    h.homeConceded += m.awayGoals;
    h.homeGames += 1;
    const a = ensure(m.awayTeamId);
    a.awayScored += m.awayGoals;
    a.awayConceded += m.homeGoals;
    a.awayGames += 1;
  }

  // Shrinkage: zieht Stärke-Verhältnisse Richtung 1.0 (Liga-Mittel). Je weniger
  // Spiele, desto stärker. K = Pseudo-Spiele. Verhindert Ausreißer und aufgeblähte
  // Edges bei kleiner Datenbasis. shrunk = (games*raw + K*1) / (games + K).
  const K = 6;
  const shrink = (raw: number, games: number) => (games * raw + K) / (games + K);

  const teams = new Map<number, TeamStrength>();
  for (const [teamId, a] of acc) {
    // Bei 0 Spielen neutral (Stärke 1.0), damit nichts durch 0 geteilt wird.
    const rawHomeAttack = a.homeGames ? a.homeScored / a.homeGames / leagueHomeGoalAvg : 1;
    const rawHomeDefense = a.homeGames ? a.homeConceded / a.homeGames / leagueAwayGoalAvg : 1;
    const rawAwayAttack = a.awayGames ? a.awayScored / a.awayGames / leagueAwayGoalAvg : 1;
    const rawAwayDefense = a.awayGames ? a.awayConceded / a.awayGames / leagueHomeGoalAvg : 1;
    const homeAttack = shrink(rawHomeAttack, a.homeGames);
    const homeDefense = shrink(rawHomeDefense, a.homeGames);
    const awayAttack = shrink(rawAwayAttack, a.awayGames);
    const awayDefense = shrink(rawAwayDefense, a.awayGames);
    teams.set(teamId, {
      teamId,
      homeAttack,
      homeDefense,
      awayAttack,
      awayDefense,
      matchesHome: a.homeGames,
      matchesAway: a.awayGames,
    });
  }

  return { leagueHomeGoalAvg, leagueAwayGoalAvg, teams };
}

/** Erwartete Tore (λ) für ein konkretes Heim-gegen-Auswärts-Spiel. */
export function expectedGoals(
  strengths: LeagueStrengths,
  homeTeamId: number,
  awayTeamId: number
): { expHomeGoals: number; expAwayGoals: number } {
  const neutral: TeamStrength = {
    teamId: -1,
    homeAttack: 1,
    homeDefense: 1,
    awayAttack: 1,
    awayDefense: 1,
    matchesHome: 0,
    matchesAway: 0,
  };
  const home = strengths.teams.get(homeTeamId) ?? neutral;
  const away = strengths.teams.get(awayTeamId) ?? neutral;

  const expHomeGoals = home.homeAttack * away.awayDefense * strengths.leagueHomeGoalAvg;
  const expAwayGoals = away.awayAttack * home.homeDefense * strengths.leagueAwayGoalAvg;

  return { expHomeGoals, expAwayGoals };
}
