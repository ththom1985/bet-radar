// Demonstriert, dass der Agent die "Wichtigkeit des Spiels" verarbeitet.
// Szenario: Abstiegskampf-Heimteam (viel Motivation) vs. saturiertes Mittelfeld-Gastteam.
// Aufruf: npx tsx --env-file=.env scripts/demo-importance.ts

import Anthropic from "@anthropic-ai/sdk";
import { explainValueBet } from "../lib/agent/explain";
import type { TeamProfile } from "../lib/stats";

const relegationTeam: TeamProfile = {
  teamId: 1, name: "Heidenheim", played: 32, wins: 8, draws: 6, losses: 18,
  goalsFor: 34, goalsAgainst: 58,
  homeRecord: { wins: 6, draws: 3, losses: 7 }, awayRecord: { wins: 2, draws: 3, losses: 11 },
  form: ["W", "W", "D", "L", "W"],
};
const midTeam: TeamProfile = {
  teamId: 2, name: "Wolfsburg", played: 32, wins: 12, draws: 8, losses: 12,
  goalsFor: 45, goalsAgainst: 46,
  homeRecord: { wins: 8, draws: 4, losses: 4 }, awayRecord: { wins: 4, draws: 4, losses: 8 },
  form: ["L", "D", "L", "W", "D"],
};

async function main() {
  const client = new Anthropic();
  const text = await explainValueBet(client, {
    league: "Bundesliga",
    kickoff: new Date(),
    homeTeam: "Heidenheim",
    awayTeam: "Wolfsburg",
    selectionLabel: "Sieg Heidenheim",
    bestOdds: 2.9,
    modelProb: 0.4,
    impliedProb: 0.345,
    edge: 0.16,
    expHomeGoals: 1.5,
    expAwayGoals: 1.4,
    home: relegationTeam,
    away: midTeam,
    h2h: { played: 2, results: [] },
    hasPlayerData: false,
    news: [],
    importanceHome: { score: 95, label: "Abstiegskampf", reason: "Abstiegskampf: Platz 16/18, 1 Punkt Vorsprung auf die Abstiegszone, 2 Spiele offen." },
    importanceAway: { score: 27, label: "Mittelfeld", reason: "Mittelfeld: Platz 11/18, ohne akutes Saisonziel, 2 Spiele offen." },
  });
  console.log("\n--- Agent-Analyse (Demo mit Wichtigkeit) ---\n");
  console.log(text);
}

main().catch((e) => { console.error(e); process.exit(1); });
