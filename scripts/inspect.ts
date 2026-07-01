import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  const bets = await prisma.valueBet.findMany({
    where: { fixture: { kickoff: { gte: new Date() } } },
    orderBy: { edge: "desc" }, take: 12,
    include: { fixture: { include: { homeTeam: true, awayTeam: true, league: true } } },
  });
  async function hist(teamId: number) {
    return prisma.fixture.count({ where: { status: "FINISHED", OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }] } });
  }
  for (const b of bets) {
    const hh = await hist(b.fixture.homeTeamId);
    const ah = await hist(b.fixture.awayTeamId);
    const sel = b.selection === "HOME" ? b.fixture.homeTeam.name : b.selection === "AWAY" ? b.fixture.awayTeam.name : "Remis";
    console.log(
      `${(b.edge * 100).toFixed(1).padStart(5)}%  ${b.fixture.league.name.padEnd(15)} ` +
      `${b.fixture.homeTeam.name} (H:${hh}) vs ${b.fixture.awayTeam.name} (H:${ah})  -> ${sel} @${b.bestOdds}  [Modell ${(b.modelProb * 100).toFixed(0)}%]`
    );
  }
}
main().finally(() => prisma.$disconnect());
