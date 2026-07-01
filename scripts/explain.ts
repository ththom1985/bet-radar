// Erzeugt Klartext-Begründungen für die aktuellen Top-Value-Wetten.
// Aufruf: npm run explain   (benötigt ANTHROPIC_API_KEY in .env)

import Anthropic from "@anthropic-ai/sdk";
import { PrismaClient } from "@prisma/client";
import { getTeamProfile, getHeadToHead, getMatchImportance, type TeamProfile } from "../lib/stats";
import { getRelevantNews } from "../lib/news/fetchNews";
import { explainValueBet } from "../lib/agent/explain";

const prisma = new PrismaClient();
const LIMIT = 10;

function selectionLabel(sel: string, home: string, away: string): string {
  if (sel === "HOME") return `Sieg ${home}`;
  if (sel === "AWAY") return `Sieg ${away}`;
  return "Unentschieden";
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("\n⚠️  ANTHROPIC_API_KEY fehlt in .env — Agent kann nicht laufen.\n");
    process.exit(1);
  }
  const client = new Anthropic();

  const bets = await prisma.valueBet.findMany({
    where: { fixture: { kickoff: { gte: new Date() } } },
    orderBy: { edge: "desc" },
    take: LIMIT,
    include: {
      fixture: {
        include: { homeTeam: true, awayTeam: true, league: true, predictions: true },
      },
    },
  });

  const profileCache = new Map<number, TeamProfile>();
  const profile = async (id: number) => {
    if (!profileCache.has(id)) profileCache.set(id, await getTeamProfile(id));
    return profileCache.get(id)!;
  };

  console.log(`Begründe ${bets.length} Value-Wetten mit dem Agenten …\n`);
  for (const b of bets) {
    const f = b.fixture;
    const pred = f.predictions.find((p) => p.model === "poisson-v1");
    if (!pred) continue;

    const home = await profile(f.homeTeamId);
    const away = await profile(f.awayTeamId);
    const h2h = await getHeadToHead(f.homeTeamId, f.awayTeamId);
    const newsItems = await getRelevantNews([f.homeTeam.name, f.awayTeam.name]);
    const importance = await getMatchImportance(f.leagueId, f.season, f.homeTeamId, f.awayTeamId);

    const reasoning = await explainValueBet(client, {
      league: f.league.name,
      kickoff: f.kickoff,
      homeTeam: f.homeTeam.name,
      awayTeam: f.awayTeam.name,
      selectionLabel: selectionLabel(b.selection, f.homeTeam.name, f.awayTeam.name),
      bestOdds: b.bestOdds,
      modelProb: b.modelProb,
      impliedProb: b.impliedProb,
      edge: b.edge,
      expHomeGoals: pred.expHomeGoals,
      expAwayGoals: pred.expAwayGoals,
      home,
      away,
      h2h,
      hasPlayerData: false,
      news: newsItems.map((n) => ({ title: n.title, source: n.source })),
      importanceHome: importance.home,
      importanceAway: importance.away,
    });

    await prisma.valueBet.update({ where: { id: b.id }, data: { reasoning } });
    console.log(`✓ ${f.homeTeam.name} vs ${f.awayTeam.name} — ${selectionLabel(b.selection, f.homeTeam.name, f.awayTeam.name)}`);
    console.log(`  ${reasoning}\n`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
