// Client für Understat (xG-Daten der 5 Topligen). Keine offizielle API:
// Die Daten stecken als hex-escaptes JSON in der Liga-Seite (var datesData = JSON.parse('...')).
// Fragil — bricht, wenn Understat das Seitenformat ändert.

export type UnderstatMatch = {
  homeTeam: string;
  awayTeam: string;
  homeGoals: number;
  awayGoals: number;
  homeXG: number;
  awayXG: number;
  isResult: boolean;
};

// Understat-Ligacodes.
export const UNDERSTAT_CODE: Record<string, string> = {
  "Premier League": "EPL",
  "La Liga": "La_liga",
  "Serie A": "Serie_A",
  Bundesliga: "Bundesliga",
  "Ligue 1": "Ligue_1",
};

function decodeEscaped(s: string): string {
  return s
    .replace(/\\x([0-9A-Fa-f]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/\\u([0-9A-Fa-f]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
}

/** Alle Spiele einer Liga-Saison mit xG (season = Startjahr, z.B. 2023 = 2023/24). */
export async function fetchLeagueMatches(code: string, season: number): Promise<UnderstatMatch[]> {
  const res = await fetch(`https://understat.com/league/${code}/${season}`);
  if (!res.ok) throw new Error(`Understat ${code}/${season} → ${res.status}`);
  const html = await res.text();
  const m = html.match(/datesData\s*=\s*JSON\.parse\('([^']+)'\)/);
  if (!m) throw new Error(`Understat ${code}/${season}: datesData nicht gefunden`);

  const raw = JSON.parse(decodeEscaped(m[1])) as Array<{
    isResult: boolean;
    h: { title: string };
    a: { title: string };
    goals: { h: string | null; a: string | null };
    xG: { h: string | null; a: string | null };
  }>;

  return raw
    .filter((r) => r.isResult && r.xG.h != null && r.goals.h != null)
    .map((r) => ({
      homeTeam: r.h.title,
      awayTeam: r.a.title,
      homeGoals: parseInt(r.goals.h!, 10),
      awayGoals: parseInt(r.goals.a!, 10),
      homeXG: parseFloat(r.xG.h!),
      awayXG: parseFloat(r.xG.a!),
      isResult: r.isResult,
    }));
}
