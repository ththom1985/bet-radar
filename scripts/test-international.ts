// Prüft Verfügbarkeit internationaler Daten (Gratis-Tiers) VOR dem Modellbau.
// Aufruf: npx tsx --env-file=.env scripts/test-international.ts

const AF = "https://v3.football.api-sports.io";
const ODDS = "https://api.the-odds-api.com/v4";

async function af(path: string) {
  const res = await fetch(`${AF}${path}`, { headers: { "x-apisports-key": process.env.API_FOOTBALL_KEY! } });
  const j = await res.json();
  return j;
}

async function main() {
  console.log("=== The Odds API — aktive internationale Wettbewerbe ===");
  const sportsRes = await fetch(`${ODDS}/sports/?apiKey=${process.env.ODDS_API_KEY}`);
  const sports = (await sportsRes.json()) as { key: string; title: string; active: boolean }[];
  const intl = sports.filter((s) =>
    /world_cup|nations_league|european_championship|uefa_euro|copa_america|internationals|friendl|qualif/i.test(s.key)
  );
  for (const s of intl) console.log(`  ${s.active ? "●" : "○"} ${s.key}  (${s.title})`);

  // Gibt es aktuell WM-Quoten?
  for (const key of ["soccer_fifa_world_cup", "soccer_uefa_nations_league"]) {
    try {
      const r = await fetch(`${ODDS}/sports/${key}/odds?regions=eu&markets=h2h&oddsFormat=decimal&apiKey=${process.env.ODDS_API_KEY}`);
      const ev = r.ok ? await r.json() : [];
      console.log(`  → ${key}: ${Array.isArray(ev) ? ev.length : 0} Spiele mit Quoten`);
    } catch { console.log(`  → ${key}: Fehler`); }
  }

  console.log("\n=== API-Football (Free) — historische internationale Ergebnisse ===");
  const probes: [string, number, number][] = [
    ["WM", 1, 2022],
    ["EM", 4, 2024],
    ["Nations League", 5, 2024],
    ["Nations League", 5, 2022],
    ["WM 2026 (erwartet gesperrt)", 1, 2026],
  ];
  for (const [name, id, season] of probes) {
    const r = await af(`/fixtures?league=${id}&season=${season}`);
    const n = Array.isArray(r.response) ? r.response.length : 0;
    const err = r.errors && Object.keys(r.errors).length ? JSON.stringify(r.errors) : "";
    console.log(`  ${name.padEnd(28)} (Liga ${id}/${season}): ${n} Spiele ${err}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
