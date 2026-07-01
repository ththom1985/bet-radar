import { getTeamInjuries } from "../lib/clients/fpl";
async function main() {
  for (const team of ["Arsenal", "Manchester City", "Liverpool", "Tottenham", "Chelsea", "Newcastle"]) {
    const inj = await getTeamInjuries(team);
    console.log(`\n${team}: ${inj.length} Meldungen`);
    for (const p of inj.slice(0, 4)) console.log(`  • ${p.name} (${p.statusLabel}${p.chance != null ? `, ${p.chance}%` : ""}): ${p.note}`);
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
export {};
