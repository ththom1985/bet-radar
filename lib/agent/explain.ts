// Begründungs-Agent: erklärt eine Value-Wette in Klartext (Deutsch).
// Nutzt ausschließlich die übergebenen Daten (Modell, Form, Bilanz, direkte Duelle).
// Erfindet KEINE Spieler-News — solange keine Aufstellungs-/Verletzungsdaten da sind,
// argumentiert er ehrlich auf Team-Ebene.

import Anthropic from "@anthropic-ai/sdk";
import type { TeamProfile, HeadToHead } from "../stats";

// Kostengünstig und gut genug für kurze Analysen. Bei Bedarf auf ein stärkeres
// Modell hochstellen (z.B. claude-opus-4-8).
const MODEL = process.env.AGENT_MODEL || "claude-sonnet-4-6";

export type ExplainContext = {
  league: string;
  kickoff: Date;
  homeTeam: string;
  awayTeam: string;
  selectionLabel: string; // z.B. "Sieg Torino" oder "Unentschieden"
  bestOdds: number;
  modelProb: number; // 0..1
  impliedProb: number; // 0..1
  edge: number; // 0..1
  expHomeGoals: number;
  expAwayGoals: number;
  home: TeamProfile;
  away: TeamProfile;
  h2h: HeadToHead;
  hasPlayerData: boolean; // bestätigte Aufstellungen (aktuell false, Free-Tier)
  news: { title: string; source: string }[]; // aktuelle Schlagzeilen zu beiden Teams
  importanceHome: { score: number; label: string; reason: string };
  importanceAway: { score: number; label: string; reason: string };
};

const SYSTEM = `Du bist ein nüchterner Fußball-Analyst für ein Wett-Dashboard.
Erkläre auf Deutsch in 3–5 kurzen Sätzen, warum das Modell bei dieser Wette einen
Vorteil (Value) gegenüber der Buchmacher-Quote sieht.

Regeln:
- Nutze NUR die gelieferten Daten (Modell-Wahrscheinlichkeit, Form, Heim-/Auswärtsbilanz,
  direkte Duelle, erwartete Tore). Erfinde nichts dazu.
- Nenne konkrete Zahlen (z.B. Form, Bilanz, Modell % vs. Quote %).
- Bleib sachlich und ehrlich. Keine Gewinnversprechen, kein Hype. Ein "Value" heißt nur:
  Das Modell hält die Wette für unterbewertet — nicht, dass sie gewinnt.
- Berücksichtige die Wichtigkeit des Spiels: Steht für ein Team viel auf dem Spiel
  (Abstiegskampf, Titel, Europa), erhöht das die Motivation/Einsatzbereitschaft — erwähne das,
  wenn ein deutlicher Unterschied zwischen den Teams besteht. Bei "Saisonstart"/"unbekannt" nicht
  darauf eingehen.
- Berücksichtige die aktuellen Schlagzeilen NUR, wenn sie spielrelevant sind (Verletzung,
  Sperre, Formkrise, Trainerwechsel, wichtiger Ausfall/Rückkehrer). Reine Transfergerüchte oder
  Finanz-/Randthemen ignorieren. Nenne eine relevante Personalie konkret (z.B. "laut Schlagzeile
  fällt X aus"), aber überbewerte unbestätigte Gerüchte nicht.
- Wenn keine bestätigten Aufstellungen vorliegen, weise am Ende in einem kurzen Halbsatz darauf hin,
  dass die endgültige Startelf noch aussteht.
- Antworte als EIN Absatz Fließtext. Keine Überschrift, kein Markdown, keine Aufzählung.
  Höchstens 5 Sätze.`;

function buildUserPrompt(c: ExplainContext): string {
  const pct = (x: number) => `${(x * 100).toFixed(0)}%`;
  const rec = (r: { wins: number; draws: number; losses: number }) =>
    `${r.wins}S ${r.draws}U ${r.losses}N`;
  const h2h = c.h2h.results
    .map((r) => `${r.homeTeam} ${r.homeGoals}:${r.awayGoals} ${r.awayTeam}`)
    .join("; ");

  return `Spiel: ${c.homeTeam} (Heim) vs ${c.awayTeam} (Auswärts), ${c.league}
Empfohlene Wette: ${c.selectionLabel} @ Quote ${c.bestOdds.toFixed(2)}
Modell-Wahrscheinlichkeit: ${pct(c.modelProb)} | Quote impliziert: ${pct(c.impliedProb)} | Vorteil: +${(c.edge * 100).toFixed(1)}%
Erwartete Tore (Modell): ${c.homeTeam} ${c.expHomeGoals.toFixed(2)} : ${c.expAwayGoals.toFixed(2)} ${c.awayTeam}

${c.homeTeam}: ${c.home.played} Spiele, Bilanz ${rec({ wins: c.home.wins, draws: c.home.draws, losses: c.home.losses })}, Tore ${c.home.goalsFor}:${c.home.goalsAgainst}, Heimbilanz ${rec(c.home.homeRecord)}, Form (neu→alt) ${c.home.form.join("") || "–"}
${c.awayTeam}: ${c.away.played} Spiele, Bilanz ${rec({ wins: c.away.wins, draws: c.away.draws, losses: c.away.losses })}, Tore ${c.away.goalsFor}:${c.away.goalsAgainst}, Auswärtsbilanz ${rec(c.away.awayRecord)}, Form (neu→alt) ${c.away.form.join("") || "–"}
Direkte Duelle: ${h2h || "keine in den Daten"}

Wichtigkeit des Spiels (aus Tabellenlage):
- ${c.homeTeam}: ${c.importanceHome.reason} (Score ${c.importanceHome.score}/100)
- ${c.awayTeam}: ${c.importanceAway.reason} (Score ${c.importanceAway.score}/100)

Aktuelle Schlagzeilen zu beiden Teams (letzte Tage):
${c.news.length ? c.news.map((n) => `- (${n.source}) ${n.title}`).join("\n") : "- keine gefunden"}

Bestätigte Aufstellungen verfügbar: ${c.hasPlayerData ? "ja" : "nein"}`;
}

export async function explainValueBet(
  client: Anthropic,
  ctx: ExplainContext
): Promise<string> {
  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 600,
    system: SYSTEM,
    messages: [{ role: "user", content: buildUserPrompt(ctx) }],
  });
  const block = msg.content.find((b) => b.type === "text");
  return block && block.type === "text" ? block.text.trim() : "";
}
