// Paper-Trading-Lauf: offene Wetten abrechnen, neue Tipps platzieren. Für den Cron.
// Aufruf: npm run paper
import { placeBets, settleBets, getPortfolio } from "../lib/paper";
import { prisma } from "../lib/prisma";

(async () => {
  const settled = await settleBets();
  const placed = await placeBets();
  const p = await getPortfolio();
  console.log(`Abgerechnet: ${settled} · neu platziert: ${placed} · offen: ${p.openCount}`);
  console.log(
    `Bankroll ${p.bankroll.toFixed(2)}€ | Netto-P/L ${p.netPL.toFixed(2)}€ | ROI ${(p.roi * 100).toFixed(1)}% ` +
      `| Trefferquote ${(p.hitRate * 100).toFixed(1)}% (${p.settledCount} abgerechnet)`
  );
})()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
