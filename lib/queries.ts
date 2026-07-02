// Server-seitige Datenabfragen fürs Dashboard.
import { prisma } from "./prisma";

// Anzeige-/Wett-Fenster: nur die nächsten 7 Tage.
function next7Days() {
  const now = new Date();
  return { gte: now, lte: new Date(now.getTime() + 7 * 24 * 3600 * 1000) };
}

export type TopBet = {
  fixtureId: number;
  league: string;
  country: string;
  kickoff: Date;
  homeTeam: string;
  awayTeam: string;
  selection: "HOME" | "DRAW" | "AWAY";
  selectionLabel: string;
  modelProb: number;
  impliedProb: number;
  bestOdds: number;
  edge: number;
  bookmaker: string;
  reasoning: string | null;
};

function selectionLabel(sel: string, home: string, away: string): string {
  if (sel === "HOME") return `Sieg ${home}`;
  if (sel === "AWAY") return `Sieg ${away}`;
  return "Unentschieden";
}

/** Die besten Value-Wetten (höchster erwarteter Vorteil zuerst). Optional nach Liga gefiltert. */
export async function getTopValueBets(limit = 10, league?: string): Promise<TopBet[]> {
  const bets = await prisma.valueBet.findMany({
    where: {
      fixture: {
        kickoff: next7Days(),
        ...(league ? { league: { name: league } } : {}),
      },
    },
    orderBy: { edge: "desc" },
    take: limit,
    include: {
      fixture: {
        include: { homeTeam: true, awayTeam: true, league: true },
      },
    },
  });

  return bets.map((b) => ({
    fixtureId: b.fixtureId,
    league: b.fixture.league.name,
    country: b.fixture.league.country,
    kickoff: b.fixture.kickoff,
    homeTeam: b.fixture.homeTeam.name,
    awayTeam: b.fixture.awayTeam.name,
    selection: b.selection as TopBet["selection"],
    selectionLabel: selectionLabel(b.selection, b.fixture.homeTeam.name, b.fixture.awayTeam.name),
    modelProb: b.modelProb,
    impliedProb: b.impliedProb,
    bestOdds: b.bestOdds,
    edge: b.edge,
    bookmaker: b.bookmaker,
    reasoning: b.reasoning,
  }));
}

export type UpcomingMatch = {
  fixtureId: number;
  league: string;
  kickoff: Date;
  homeTeam: string;
  awayTeam: string;
  odds: { home: number; draw: number; away: number } | null;
  model: { pHome: number; pDraw: number; pAway: number; expHomeGoals: number; expAwayGoals: number } | null;
  hasValue: boolean;
};

/** Alle anstehenden Spiele mit Modell-Wahrscheinlichkeiten und Quoten. */
export async function getUpcomingMatches(): Promise<UpcomingMatch[]> {
  const fixtures = await prisma.fixture.findMany({
    where: { status: "SCHEDULED", kickoff: next7Days() },
    orderBy: { kickoff: "asc" },
    include: {
      homeTeam: true,
      awayTeam: true,
      league: true,
      odds: { orderBy: { fetchedAt: "desc" } },
      predictions: { where: { model: "poisson-v1" } },
      valueBets: true,
    },
  });

  return fixtures.map((f) => {
    const best = f.odds.length
      ? {
          home: Math.max(...f.odds.map((o) => o.homeOdds)),
          draw: Math.max(...f.odds.map((o) => o.drawOdds)),
          away: Math.max(...f.odds.map((o) => o.awayOdds)),
        }
      : null;
    const pred = f.predictions[0];
    return {
      fixtureId: f.id,
      league: f.league.name,
      kickoff: f.kickoff,
      homeTeam: f.homeTeam.name,
      awayTeam: f.awayTeam.name,
      odds: best,
      model: pred
        ? {
            pHome: pred.pHome,
            pDraw: pred.pDraw,
            pAway: pred.pAway,
            expHomeGoals: pred.expHomeGoals,
            expAwayGoals: pred.expAwayGoals,
          }
        : null,
      hasValue: f.valueBets.length > 0,
    };
  });
}

/** Ligen, die aktuell Value-Wetten haben (für Filter-Chips). */
export async function getLeaguesWithBets(): Promise<string[]> {
  const rows = await prisma.valueBet.findMany({
    where: { fixture: { kickoff: next7Days() } },
    select: { fixture: { select: { league: { select: { name: true } } } } },
    distinct: ["fixtureId"],
  });
  return [...new Set(rows.map((r) => r.fixture.league.name))].sort();
}

/** Elo-Weltrangliste (aus dem Snapshot der internationalen Pipeline). */
export async function getEloRanking(): Promise<{ team: string; rating: number; games: number }[]> {
  const snap = await prisma.snapshot.findUnique({ where: { key: "elo-ranking" } });
  if (!snap) return [];
  try {
    return JSON.parse(snap.value) as { team: string; rating: number; games: number }[];
  } catch {
    return [];
  }
}

/** Kennzahlen für den Kopfbereich. */
export async function getStats() {
  const [leagues, teams, upcoming, valueBets, finished] = await Promise.all([
    prisma.league.count(),
    prisma.team.count(),
    prisma.fixture.count({ where: { status: "SCHEDULED" } }),
    prisma.valueBet.count(),
    prisma.fixture.count({ where: { status: "FINISHED" } }),
  ]);
  return { leagues, teams, upcoming, valueBets, finished };
}
