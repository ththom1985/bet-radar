// Diagnose für API-Football: Account-Status + welche Saisons liefern Spiele?
// Aufruf: npx tsx --env-file=.env scripts/test-football.ts

const BASE = "https://v3.football.api-sports.io";

async function get(path: string) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "x-apisports-key": process.env.API_FOOTBALL_KEY! },
  });
  const json = await res.json();
  return json;
}

async function main() {
  if (!process.env.API_FOOTBALL_KEY) throw new Error("API_FOOTBALL_KEY fehlt");

  const status = await get("/status");
  console.log("Account:", JSON.stringify(status.response?.subscription ?? status.response, null, 2));
  console.log("Requests:", JSON.stringify(status.response?.requests ?? {}, null, 2));
  console.log("");

  // Coverage der Premier League (Liga 39): welche Saisons sind verfügbar?
  const leagues = await get("/leagues?id=39");
  const seasons = leagues.response?.[0]?.seasons ?? [];
  console.log(
    "Premier League — verfügbare Saisons:",
    seasons.map((s: { year: number }) => s.year).join(", ")
  );
  console.log("");

  // Fixture-Anzahl je Saison testen (Liga 39).
  for (const season of [2023, 2024, 2025, 2026]) {
    const fx = await get(`/fixtures?league=39&season=${season}`);
    const n = Array.isArray(fx.response) ? fx.response.length : 0;
    const err = fx.errors && Object.keys(fx.errors).length ? JSON.stringify(fx.errors) : "";
    console.log(`  Saison ${season}: ${n} Spiele ${err}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

export {};
