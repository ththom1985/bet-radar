// Client für OpenLigaDB (api.openligadb.de) — gratis, kein Key, 1000 Anfragen/Std.
// Beste freie Quelle für Bundesliga: Ergebnisse, Torschützen, Tabelle, Spielplan.
// Keine Verletzungen/Aufstellungen (die gibt es hier nicht).

const BASE = "https://api.openligadb.de";

export type OldMatch = {
  id: number;
  homeTeam: string;
  awayTeam: string;
  homeGoals: number;
  awayGoals: number;
  finished: boolean;
  date: Date;
  matchday: number;
  scorers: string[]; // Torschützen
};

type RawResult = { resultTypeID: number; pointsTeam1: number; pointsTeam2: number };
type RawGoal = { goalGetterName: string | null };
type RawMatch = {
  matchID: number;
  team1: { teamName: string };
  team2: { teamName: string };
  matchIsFinished: boolean;
  matchDateTimeUTC: string;
  group: { groupOrderID: number };
  matchResults: RawResult[];
  goals: RawGoal[];
};

/** Alle Spiele einer Bundesliga-Saison (season = Startjahr, z.B. 2025 = 25/26). */
export async function getBundesligaMatches(season: number): Promise<OldMatch[]> {
  const res = await fetch(`${BASE}/getmatchdata/bl1/${season}`);
  if (!res.ok) throw new Error(`OpenLigaDB ${res.status}`);
  const raw = (await res.json()) as RawMatch[];
  return raw.map((m) => {
    const final = m.matchResults?.find((r) => r.resultTypeID === 2); // Endergebnis
    return {
      id: m.matchID,
      homeTeam: m.team1.teamName,
      awayTeam: m.team2.teamName,
      homeGoals: final?.pointsTeam1 ?? 0,
      awayGoals: final?.pointsTeam2 ?? 0,
      finished: m.matchIsFinished,
      date: new Date(m.matchDateTimeUTC),
      matchday: m.group?.groupOrderID ?? 0,
      scorers: (m.goals ?? []).map((g) => g.goalGetterName).filter((n): n is string => !!n),
    };
  });
}

export type OldTableRow = { position: number; team: string; points: number; played: number; goalDiff: number };

/** Aktuelle Bundesliga-Tabelle. */
export async function getBundesligaTable(season: number): Promise<OldTableRow[]> {
  const res = await fetch(`${BASE}/getbltable/bl1/${season}`);
  if (!res.ok) throw new Error(`OpenLigaDB ${res.status}`);
  const raw = (await res.json()) as {
    teamName: string;
    points: number;
    matches: number;
    goalDiff: number;
  }[];
  return raw.map((r, i) => ({
    position: i + 1,
    team: r.teamName,
    points: r.points,
    played: r.matches,
    goalDiff: r.goalDiff,
  }));
}
