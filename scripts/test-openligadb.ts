import { getBundesligaTable, getBundesligaMatches } from "../lib/clients/openligadb";
async function main() {
  const table = await getBundesligaTable(2025);
  console.log("Tabelle Top 4:"); table.slice(0,4).forEach(r=>console.log(`  ${r.position}. ${r.team} ${r.points} Pkt (${r.played} Sp., TD ${r.goalDiff})`));
  const m = (await getBundesligaMatches(2025)).filter(x=>x.finished);
  console.log(`\n${m.length} beendete Spiele. Beispiel mit Torschützen:`);
  const ex = m.find(x=>x.scorers.length)||m[0];
  console.log(`  ${ex.homeTeam} ${ex.homeGoals}:${ex.awayGoals} ${ex.awayTeam} — Torschützen: ${ex.scorers.join(", ")}`);
}
main().catch(e=>{console.error(e);process.exit(1)});
export {};
