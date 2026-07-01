// Aktueller Cheftrainer je Team über API-Football (/coachs).
// WICHTIG: /coachs ist NICHT saison-gesperrt → liefert den aktuellen Trainer,
// auch wenn Fixtures im Free-Tier nur 2022–2024 abrufbar sind.

const BASE = "https://v3.football.api-sports.io";

export type Coach = { name: string; since: string | null };

type CareerEntry = { team: { id: number } | null; start: string | null; end: string | null };
type RawCoach = { name: string; age: number | null; career: CareerEntry[] };

const cache = new Map<number, Coach | null>();

/** Aktueller Trainer eines Teams (nach API-Football-Team-ID). null, wenn unbekannt. */
export async function getCurrentCoach(teamApiId: number | null): Promise<Coach | null> {
  if (!teamApiId || !process.env.API_FOOTBALL_KEY) return null;
  if (cache.has(teamApiId)) return cache.get(teamApiId)!;

  let coach: Coach | null = null;
  try {
    const res = await fetch(`${BASE}/coachs?team=${teamApiId}`, {
      headers: { "x-apisports-key": process.env.API_FOOTBALL_KEY },
    });
    if (res.ok) {
      const data = (await res.json()) as { response: RawCoach[] };
      for (const c of data.response ?? []) {
        // Aktueller Trainer = offener Karriere-Eintrag (kein Enddatum) bei diesem Team.
        const current = (c.career ?? []).find((x) => x.team?.id === teamApiId && !x.end);
        if (current) {
          coach = { name: c.name, since: current.start };
          break;
        }
      }
    }
  } catch {
    // still null
  }
  cache.set(teamApiId, coach);
  return coach;
}
