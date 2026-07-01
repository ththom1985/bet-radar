// Team-Statistiken aus der Historie (beendete Spiele) — Kontext für den Agenten.
import { prisma } from "./prisma";

export type TeamProfile = {
  teamId: number;
  name: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  homeRecord: { wins: number; draws: number; losses: number };
  awayRecord: { wins: number; draws: number; losses: number };
  /** Letzte Spiele (neueste zuerst) als "W"/"D"/"L". */
  form: string[];
};

export async function getTeamProfile(teamId: number): Promise<TeamProfile> {
  const team = await prisma.team.findUnique({ where: { id: teamId } });
  const games = await prisma.fixture.findMany({
    where: {
      status: "FINISHED",
      homeGoals: { not: null },
      OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }],
    },
    orderBy: { kickoff: "desc" },
  });

  const p: TeamProfile = {
    teamId,
    name: team?.name ?? `Team ${teamId}`,
    played: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    homeRecord: { wins: 0, draws: 0, losses: 0 },
    awayRecord: { wins: 0, draws: 0, losses: 0 },
    form: [],
  };

  for (const g of games) {
    const isHome = g.homeTeamId === teamId;
    const gf = isHome ? g.homeGoals! : g.awayGoals!;
    const ga = isHome ? g.awayGoals! : g.homeGoals!;
    p.played++;
    p.goalsFor += gf;
    p.goalsAgainst += ga;
    const res = gf > ga ? "W" : gf === ga ? "D" : "L";
    if (res === "W") p.wins++;
    else if (res === "D") p.draws++;
    else p.losses++;
    const rec = isHome ? p.homeRecord : p.awayRecord;
    if (res === "W") rec.wins++;
    else if (res === "D") rec.draws++;
    else rec.losses++;
    if (p.form.length < 5) p.form.push(res);
  }
  return p;
}

export type HeadToHead = {
  played: number;
  results: { date: Date; homeTeam: string; awayTeam: string; homeGoals: number; awayGoals: number }[];
};

/** Direkte Duelle beider Teams aus der Historie (beide Spielorte). */
export async function getHeadToHead(teamAId: number, teamBId: number): Promise<HeadToHead> {
  const games = await prisma.fixture.findMany({
    where: {
      status: "FINISHED",
      homeGoals: { not: null },
      OR: [
        { homeTeamId: teamAId, awayTeamId: teamBId },
        { homeTeamId: teamBId, awayTeamId: teamAId },
      ],
    },
    orderBy: { kickoff: "desc" },
    include: { homeTeam: true, awayTeam: true },
    take: 6,
  });
  return {
    played: games.length,
    results: games.map((g) => ({
      date: g.kickoff,
      homeTeam: g.homeTeam.name,
      awayTeam: g.awayTeam.name,
      homeGoals: g.homeGoals!,
      awayGoals: g.awayGoals!,
    })),
  };
}
