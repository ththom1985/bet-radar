// Prüft, ob Understat-Scraping funktioniert und zeigt Teamnamen (für Abgleich mit Football-Data).
import { fetchLeagueMatches, UNDERSTAT_CODE } from "../lib/clients/understat";

async function main() {
  const matches = await fetchLeagueMatches(UNDERSTAT_CODE["Premier League"], 2023);
  console.log(`Premier League 2023/24: ${matches.length} Spiele mit xG\n`);
  console.log("Beispiele:");
  for (const m of matches.slice(0, 3)) {
    console.log(`  ${m.homeTeam} ${m.homeGoals} (xG ${m.homeXG}) : ${m.awayGoals} (xG ${m.awayXG}) ${m.awayTeam}`);
  }
  const teams = [...new Set(matches.map((m) => m.homeTeam))].sort();
  console.log(`\nTeamnamen (${teams.length}):`);
  console.log("  " + teams.join(" | "));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
