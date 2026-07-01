// Client für API-Football (v3, direktes API-Sports-Hosting).
// Docs: https://www.api-football.com/documentation-v3
// Free-Tier: 100 Requests/Tag — deshalb sparsam einsetzen (Sync 1×/Tag).

const BASE = "https://v3.football.api-sports.io";

function key(): string {
  const k = process.env.API_FOOTBALL_KEY;
  if (!k) throw new Error("API_FOOTBALL_KEY fehlt in .env");
  return k;
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "x-apisports-key": key() },
  });
  if (!res.ok) {
    throw new Error(`API-Football ${res.status}: ${await res.text()}`);
  }
  const json = await res.json();
  if (json.errors && Object.keys(json.errors).length > 0) {
    throw new Error(`API-Football Fehler: ${JSON.stringify(json.errors)}`);
  }
  return json.response as T;
}

export type AfTeam = { team: { id: number; name: string } };

export async function fetchTeams(leagueId: number, season: number): Promise<AfTeam[]> {
  return get<AfTeam[]>(`/teams?league=${leagueId}&season=${season}`);
}

export type AfFixture = {
  fixture: { id: number; date: string; status: { short: string } };
  league: { round: string };
  teams: { home: { id: number; name: string }; away: { id: number; name: string } };
  goals: { home: number | null; away: number | null };
};

export async function fetchFixtures(leagueId: number, season: number): Promise<AfFixture[]> {
  return get<AfFixture[]>(`/fixtures?league=${leagueId}&season=${season}`);
}

/** "FT", "AET", "PEN" = beendet. */
export function isFinished(shortStatus: string): boolean {
  return ["FT", "AET", "PEN"].includes(shortStatus);
}
