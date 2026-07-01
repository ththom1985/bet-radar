// Schneller Verbindungstest für The Odds API:
// 1) Welche Fußball-Ligen sind aktuell "in-season" (haben Quoten)?
// 2) Für unsere 5 Ligen: wie viele Spiele mit Quoten kommen zurück?
// Aufruf: npx tsx --env-file=.env scripts/test-odds.ts

import { LEAGUES } from "../lib/leagues";
import { fetchOdds, bestThreeWay } from "../lib/clients/oddsApi";

async function main() {
  const key = process.env.ODDS_API_KEY;
  if (!key) throw new Error("ODDS_API_KEY fehlt");

  // Liste aller aktiven Sportarten (kostet kein Credit).
  const sportsRes = await fetch(`https://api.the-odds-api.com/v4/sports/?apiKey=${key}`);
  const remaining = sportsRes.headers.get("x-requests-remaining");
  const used = sportsRes.headers.get("x-requests-used");
  console.log(`Credits — verbraucht: ${used}, verbleibend: ${remaining}\n`);

  const sports = (await sportsRes.json()) as { key: string; title: string; active: boolean }[];
  const activeSoccer = sports.filter((s) => s.key.startsWith("soccer") && s.active);
  console.log(`Aktive Fußball-Ligen bei The Odds API: ${activeSoccer.length}`);
  for (const s of activeSoccer) console.log(`  ${s.key}  (${s.title})`);
  console.log("");

  for (const cfg of LEAGUES) {
    try {
      const events = await fetchOdds(cfg.oddsApiKey);
      const withOdds = events.filter((e) => bestThreeWay(e) !== null);
      console.log(`${cfg.name} (${cfg.oddsApiKey}): ${events.length} Spiele, davon ${withOdds.length} mit 1X2-Quoten`);
      const sample = withOdds[0];
      if (sample) {
        const t = bestThreeWay(sample)!;
        console.log(`   Beispiel: ${sample.home_team} vs ${sample.away_team} → ${t.home} / ${t.draw} / ${t.away} (${t.bookmaker})`);
      }
    } catch (e) {
      console.log(`${cfg.name}: Fehler — ${(e as Error).message}`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
