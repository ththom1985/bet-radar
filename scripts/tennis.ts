// Tennis-Vorhersagen (belagsabhängiges Elo) in die DB → Dashboard & Tracker.
// Aufruf: npm run tennis
import { runTennis } from "../lib/tennis";
import { prisma } from "../lib/prisma";

runTennis()
  .then((r) => console.log(`Tennis-Matches gespeichert: ${r.stored}, Value-Wetten: ${r.valueCount}`))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
