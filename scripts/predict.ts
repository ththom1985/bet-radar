// Startet den Modell-Lauf über die Datenbank (CLI).
import { runPredictions } from "../lib/predict";
import { prisma } from "../lib/prisma";

runPredictions()
  .then((r) => console.log(`Vorhersagen: ${r.predicted}, Value-Wetten: ${r.valueCount}`))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
