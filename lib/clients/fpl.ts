// Client für die offizielle Fantasy-Premier-League-API (gratis, kein Key).
// Liefert Verletzungs-/Einsatzstatus aller PL-Spieler — NUR England.
// Endpoint: https://fantasy.premierleague.com/api/bootstrap-static/

type FplElement = {
  first_name: string;
  second_name: string;
  web_name: string;
  team: number;
  status: string; // a=fit, i=injured, d=doubtful, s=suspended, u=unavailable
  news: string;
  chance_of_playing_next_round: number | null;
};
type FplTeam = { id: number; name: string };

export type PlayerNews = {
  name: string;
  statusLabel: string;
  note: string; // Original-Meldung von FPL, z.B. "Knee injury - 75% chance"
  chance: number | null;
};

const STATUS: Record<string, string> = {
  i: "verletzt",
  d: "fraglich",
  s: "gesperrt",
  u: "nicht verfügbar",
};

// Alias-Normalisierung für PL-Vereinsnamen (FPL kurz vs. unsere langen Namen).
function normClub(name: string): string {
  const b = name.toLowerCase().replace(/[^a-z]/g, "");
  const map: Record<string, string> = {
    manutd: "manchesterunited", manunited: "manchesterunited",
    mancity: "manchestercity",
    spurs: "tottenham", tottenhamhotspur: "tottenham",
    wolves: "wolverhampton", wolverhamptonwanderers: "wolverhampton",
    nottmforest: "nottinghamforest", forest: "nottinghamforest",
    newcastleunited: "newcastle", westhamunited: "westham", westham: "westham",
    brightonhovealbion: "brighton",
  };
  return map[b] ?? b;
}

let cache: { byTeam: Map<string, PlayerNews[]>; teams: Set<string> } | null = null;

async function load() {
  if (cache) return cache;
  const res = await fetch("https://fantasy.premierleague.com/api/bootstrap-static/");
  if (!res.ok) throw new Error(`FPL ${res.status}`);
  const data = (await res.json()) as { elements: FplElement[]; teams: FplTeam[] };
  const teamName = new Map(data.teams.map((t) => [t.id, t.name]));
  const teams = new Set(data.teams.map((t) => normClub(t.name)));

  const byTeam = new Map<string, PlayerNews[]>();
  for (const p of data.elements) {
    // Nur spielrelevant: verletzt (i), fraglich (d), gesperrt (s). Transfers (u) ignorieren.
    if (!["i", "d", "s"].includes(p.status) || !p.news) continue;
    const club = normClub(teamName.get(p.team) ?? "");
    const list = byTeam.get(club) ?? [];
    list.push({
      name: p.web_name,
      statusLabel: STATUS[p.status] ?? p.status,
      note: p.news,
      chance: p.chance_of_playing_next_round,
    });
    byTeam.set(club, list);
  }
  cache = { byTeam, teams };
  return cache;
}

/** Verletzte/fragliche/gesperrte Spieler eines PL-Teams (leer, wenn nicht England oder alle fit). */
export async function getTeamInjuries(teamName: string): Promise<PlayerNews[]> {
  const { byTeam } = await load();
  return byTeam.get(normClub(teamName)) ?? [];
}

/** Ob die FPL-API dieses Team abdeckt (= Premier-League-Team). */
export async function fplCovers(teamName: string): Promise<boolean> {
  const { teams } = await load();
  return teams.has(normClub(teamName));
}
