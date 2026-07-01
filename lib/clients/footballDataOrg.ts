// Client für football-data.org (v4) — AKTUELLE Saison, nicht saison-gesperrt.
// Free-Tier: 10 Anfragen/Min, 12 Wettbewerbe, verzögert, keine Spielerdaten.
// Docs: https://docs.football-data.org

const BASE = "https://api.football-data.org/v4";

function key(): string {
  const k = process.env.FOOTBALL_DATA_ORG_KEY;
  if (!k) throw new Error("FOOTBALL_DATA_ORG_KEY fehlt in .env");
  return k;
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { headers: { "X-Auth-Token": key() } });
  if (!res.ok) throw new Error(`football-data.org ${res.status}: ${path}`);
  return res.json() as Promise<T>;
}

// Wettbewerbs-Codes im Free-Tier.
export const FD_CODES: Record<string, string> = {
  "Premier League": "PL",
  Bundesliga: "BL1",
  "Serie A": "SA",
  "La Liga": "PD",
  "Ligue 1": "FL1",
  "World Cup": "WC",
  "Champions League": "CL",
};

export type FdMatch = {
  homeTeam: string;
  awayTeam: string;
  homeGoals: number;
  awayGoals: number;
  date: Date;
  finished: boolean;
  stage: string;
};

type RawMatch = {
  status: string;
  utcDate: string;
  stage: string;
  homeTeam: { name: string | null };
  awayTeam: { name: string | null };
  score: { fullTime: { home: number | null; away: number | null } };
};

/** Alle Spiele eines Wettbewerbs (aktuelle Saison). */
export async function getMatches(code: string): Promise<FdMatch[]> {
  const data = await get<{ matches: RawMatch[] }>(`/competitions/${code}/matches`);
  return (data.matches ?? [])
    .filter((m) => m.homeTeam.name && m.awayTeam.name)
    .map((m) => ({
      homeTeam: m.homeTeam.name!,
      awayTeam: m.awayTeam.name!,
      homeGoals: m.score.fullTime.home ?? 0,
      awayGoals: m.score.fullTime.away ?? 0,
      date: new Date(m.utcDate),
      finished: m.status === "FINISHED",
      stage: m.stage,
    }));
}

export type FdStanding = { position: number; team: string; points: number; played: number };

/** Aktuelle Tabelle eines Ligawettbewerbs. */
export async function getStandings(code: string): Promise<{ season: string; table: FdStanding[] }> {
  const data = await get<{
    season: { startDate: string };
    standings: { type: string; table: { position: number; team: { name: string }; points: number; playedGames: number }[] }[];
  }>(`/competitions/${code}/standings`);
  const total = data.standings?.find((s) => s.type === "TOTAL") ?? data.standings?.[0];
  return {
    season: data.season?.startDate ?? "?",
    table: (total?.table ?? []).map((r) => ({
      position: r.position,
      team: r.team.name,
      points: r.points,
      played: r.playedGames,
    })),
  };
}
