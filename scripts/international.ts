// Rechnet die WM-Vorhersagen (Elo) und schreibt sie in die DB → erscheinen im Dashboard.
// Aufruf: npm run intl
import { runInternational } from "../lib/international";
import { prisma } from "../lib/prisma";

runInternational()
  .then((r) => {
    console.log("Top 10 Nationalmannschaften (Elo):");
    r.ranking.forEach((x) => console.log(`  ${x.rating}  ${x.team}`));
    console.log(`\nWM-Spiele gespeichert: ${r.stored}, Value-Wetten: ${r.valueCount}`);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
