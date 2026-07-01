// Demonstriert die Wichtigkeits-Engine an der Abschlusstabelle 2024 je Liga.
import { PrismaClient } from "@prisma/client";
import { buildStandings, matchImportance } from "../lib/importance";

const prisma = new PrismaClient();

async function main() {
  const leagues = await prisma.league.findMany();
  for (const lg of leagues) {
    const fx = await prisma.fixture.findMany({
      where: { leagueId: lg.id, status: "FINISHED", homeGoals: { not: null } },
      include: { homeTeam: true, awayTeam: true },
    });
    if (fx.length === 0) continue;

    const names = new Map<number, string>();
    for (const f of fx) {
      names.set(f.homeTeamId, f.homeTeam.name);
      names.set(f.awayTeamId, f.awayTeam.name);
    }
    const standings = buildStandings(
      fx.map((f) => ({ homeTeamId: f.homeTeamId, awayTeamId: f.awayTeamId, homeGoals: f.homeGoals!, awayGoals: f.awayGoals! })),
      names
    );
    const totalMd = Math.max(...standings.map((s) => s.played));

    console.log(`\n=== ${lg.name} (Abschlusstabelle 2024, ${standings.length} Teams) ===`);
    for (const s of standings) {
      const imp = matchImportance(standings, totalMd, s.teamId);
      console.log(
        `  ${String(s.position).padStart(2)}. ${s.name.padEnd(24)} ${String(s.points).padStart(2)} Pkt  →  [${String(imp.score).padStart(3)}] ${imp.reason}`
      );
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
