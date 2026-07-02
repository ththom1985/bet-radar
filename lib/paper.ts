// Paper-Trading: SIMULIERTE Wetten (kein echtes Geld). Trackt, ob die Tipps
// des Modells über die Zeit profitabel wären — mit 5% Wettsteuer auf den Umsatz.

import { prisma } from "./prisma";
import { normalizeClub } from "./clubs";
import { normalizeNation } from "./nations";

export const INITIAL_BANKROLL = 1000; // €, virtuell
export const STAKE = 20; // € Einsatz je Wette (flach, 2% des Startkapitals)
export const EDGE_THRESHOLD = 0.1; // "gewisses Potenzial": nur Tipps ab +10% Vorteil
export const TAX_RATE = 0.05; // 5% deutsche Wettsteuer auf den Umsatz

function label(sel: string, home: string, away: string) {
  return sel === "HOME" ? `Sieg ${home}` : sel === "AWAY" ? `Sieg ${away}` : "Unentschieden";
}

// Zwei Namen gelten als dasselbe Team, wenn Vereins- ODER Nations-Normalisierung passt.
function sameTeam(a: string, b: string): boolean {
  return normalizeClub(a) === normalizeClub(b) || normalizeNation(a) === normalizeNation(b);
}

/** Setzt simulierte Wetten auf alle aktuellen Value-Tipps über der Potenzial-Schwelle. */
export async function placeBets() {
  const candidates = await prisma.valueBet.findMany({
    where: { edge: { gte: EDGE_THRESHOLD }, fixture: { kickoff: { gte: new Date() } } },
    include: { fixture: { include: { homeTeam: true, awayTeam: true, league: true } } },
  });

  const rows = candidates.map((b) => ({
    fixtureId: b.fixtureId,
    league: b.fixture.league.name,
    homeTeam: b.fixture.homeTeam.name,
    awayTeam: b.fixture.awayTeam.name,
    kickoff: b.fixture.kickoff,
    selection: b.selection,
    selectionLabel: label(b.selection, b.fixture.homeTeam.name, b.fixture.awayTeam.name),
    odds: b.bestOdds,
    stake: STAKE,
    edge: b.edge,
    status: "OPEN",
  }));
  // skipDuplicates: bereits platzierte (fixtureId+selection) werden übersprungen.
  const res = await prisma.paperBet.createMany({ data: rows, skipDuplicates: true });
  return res.count;
}

/** Rechnet offene Wetten ab, deren Spiel vorbei ist (Ergebnis aus beendeten Fixtures). */
export async function settleBets() {
  const open = await prisma.paperBet.findMany({ where: { status: "OPEN", kickoff: { lt: new Date() } } });
  let settled = 0;

  for (const bet of open) {
    // Beendetes Spiel mit passenden Teams im Zeitfenster (±3 Tage) suchen.
    const from = new Date(bet.kickoff.getTime() - 3 * 864e5);
    const to = new Date(bet.kickoff.getTime() + 3 * 864e5);
    const finished = await prisma.fixture.findMany({
      where: { status: "FINISHED", homeGoals: { not: null }, kickoff: { gte: from, lte: to } },
      include: { homeTeam: true, awayTeam: true },
    });
    const match = finished.find(
      (f) => sameTeam(f.homeTeam.name, bet.homeTeam) && sameTeam(f.awayTeam.name, bet.awayTeam)
    );
    if (!match) continue; // Ergebnis noch nicht in den Daten → offen lassen

    const res = match.homeGoals! > match.awayGoals! ? "HOME" : match.homeGoals! < match.awayGoals! ? "AWAY" : "DRAW";
    const won = res === bet.selection;
    await prisma.paperBet.update({
      where: { id: bet.id },
      data: {
        status: won ? "WON" : "LOST",
        payout: won ? bet.stake * bet.odds : 0,
        resultScore: `${match.homeGoals}:${match.awayGoals}`,
        settledAt: new Date(),
      },
    });
    settled++;
  }
  return settled;
}

export type Portfolio = {
  initial: number;
  stake: number;
  edgeThreshold: number;
  taxRate: number;
  openCount: number;
  openStake: number;
  settledCount: number;
  wins: number;
  hitRate: number;
  turnover: number; // Umsatz = Summe der abgerechneten Einsätze
  returns: number; // Rückfluss aus Gewinnwetten
  tax: number; // 5% auf Umsatz
  grossPL: number; // returns - turnover
  netPL: number; // grossPL - tax
  bankroll: number; // initial + netPL
  roi: number; // netPL / turnover
  equity: { date: string; bankroll: number }[]; // Verlauf
  openBets: { league: string; match: string; pick: string; odds: number; kickoff: Date; edge: number }[];
  recent: { league: string; match: string; pick: string; odds: number; score: string; won: boolean; settledAt: Date }[];
};

export async function getPortfolio(): Promise<Portfolio> {
  const settledBets = await prisma.paperBet.findMany({
    where: { status: { in: ["WON", "LOST"] } },
    orderBy: { settledAt: "asc" },
  });
  const openBetsRaw = await prisma.paperBet.findMany({
    where: { status: "OPEN" },
    orderBy: { kickoff: "asc" },
  });

  const turnover = settledBets.reduce((s, b) => s + b.stake, 0);
  const returns = settledBets.reduce((s, b) => s + (b.payout ?? 0), 0);
  const wins = settledBets.filter((b) => b.status === "WON").length;
  const tax = turnover * TAX_RATE;
  const grossPL = returns - turnover;
  const netPL = grossPL - tax;

  // Equity-Kurve (Bankroll über abgerechnete Wetten, inkl. anteiliger Steuer).
  let run = INITIAL_BANKROLL;
  const equity: { date: string; bankroll: number }[] = [
    { date: "Start", bankroll: INITIAL_BANKROLL },
  ];
  for (const b of settledBets) {
    const pl = (b.payout ?? 0) - b.stake - b.stake * TAX_RATE;
    run += pl;
    equity.push({
      date: b.settledAt ? b.settledAt.toISOString().slice(0, 10) : "",
      bankroll: Math.round(run * 100) / 100,
    });
  }

  return {
    initial: INITIAL_BANKROLL,
    stake: STAKE,
    edgeThreshold: EDGE_THRESHOLD,
    taxRate: TAX_RATE,
    openCount: openBetsRaw.length,
    openStake: openBetsRaw.reduce((s, b) => s + b.stake, 0),
    settledCount: settledBets.length,
    wins,
    hitRate: settledBets.length ? wins / settledBets.length : 0,
    turnover,
    returns,
    tax,
    grossPL,
    netPL,
    bankroll: INITIAL_BANKROLL + netPL,
    roi: turnover ? netPL / turnover : 0,
    equity,
    openBets: openBetsRaw.map((b) => ({
      league: b.league,
      match: `${b.homeTeam} vs ${b.awayTeam}`,
      pick: b.selectionLabel,
      odds: b.odds,
      kickoff: b.kickoff,
      edge: b.edge,
    })),
    recent: [...settledBets].reverse().slice(0, 15).map((b) => ({
      league: b.league,
      match: `${b.homeTeam} vs ${b.awayTeam}`,
      pick: b.selectionLabel,
      odds: b.odds,
      score: b.resultScore ?? "",
      won: b.status === "WON",
      settledAt: b.settledAt ?? new Date(),
    })),
  };
}
