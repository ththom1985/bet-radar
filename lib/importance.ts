// "Wichtigkeit des Spiels": Wie viel steht für eine Mannschaft auf dem Spiel?
// Leitet aus der Tabellensituation einen Score (0–100) + Begründung ab.
//
// Braucht die AKTUELLE Tabelle der laufenden Saison. Solange keine Live-Tabelle
// vorliegt (Saisonstart / Free-Tier), liefert die Funktion ehrlich "Saisonstart".

export type Standing = {
  teamId: number;
  name: string;
  position: number; // 1 = Tabellenführer
  points: number;
  played: number;
};

export type MatchImportance = {
  score: number; // 0–100
  label: string; // z.B. "Abstiegskampf"
  reason: string; // Klartext
};

// Anzahl Plätze je Zone (vereinfachte Annahme, gilt grob für alle 5 Topligen).
const RELEGATION_SPOTS = 3;
const CL_SPOTS = 4;
const EUROPE_SPOTS = 6;

/** Baut eine Tabelle aus beendeten Spielen (3 Punkte Sieg, 1 Remis). */
export function buildStandings(
  matches: { homeTeamId: number; awayTeamId: number; homeGoals: number; awayGoals: number }[],
  names: Map<number, string>
): Standing[] {
  const pts = new Map<number, { points: number; played: number }>();
  const ens = (id: number) => {
    let e = pts.get(id);
    if (!e) pts.set(id, (e = { points: 0, played: 0 }));
    return e;
  };
  for (const m of matches) {
    const h = ens(m.homeTeamId);
    const a = ens(m.awayTeamId);
    h.played++;
    a.played++;
    if (m.homeGoals > m.awayGoals) h.points += 3;
    else if (m.homeGoals < m.awayGoals) a.points += 3;
    else {
      h.points++;
      a.points++;
    }
  }
  return [...pts.entries()]
    .map(([teamId, e]) => ({ teamId, name: names.get(teamId) ?? `Team ${teamId}`, ...e }))
    .sort((x, y) => y.points - x.points || x.name.localeCompare(y.name))
    .map((s, i) => ({ ...s, position: i + 1 }));
}

/** Wichtigkeit für ein Team in dieser Tabellensituation. totalMatchdays z.B. 34 oder 38. */
export function matchImportance(
  standings: Standing[],
  totalMatchdays: number,
  teamId: number
): MatchImportance {
  const N = standings.length;
  const team = standings.find((s) => s.teamId === teamId);
  if (!team || N < 4) {
    return { score: 0, label: "unbekannt", reason: "Keine Tabellendaten verfügbar." };
  }
  if (team.played < 3) {
    return {
      score: 15,
      label: "Saisonstart",
      reason: "Saison gerade gestartet – noch keine aussagekräftige Tabellenlage.",
    };
  }

  const remaining = Math.max(0, totalMatchdays - team.played);
  const progress = Math.min(1, team.played / totalMatchdays);
  const urgency = 0.5 + 0.5 * progress; // spät in der Saison zählt mehr
  const pos = team.position;

  const ptsAt = (p: number) => standings[Math.min(Math.max(p, 1), N) - 1]?.points ?? 0;
  const leaderPts = ptsAt(1);
  const clLinePts = ptsAt(CL_SPOTS); // 4. Platz
  const safeLinePts = ptsAt(N - RELEGATION_SPOTS); // letzter sicherer Platz
  const maxSwing = remaining * 3; // theoretisch noch erreichbare Punkte

  let base: number, label: string, detail: string;

  if (pos >= N - RELEGATION_SPOTS - 1) {
    // Abstiegszone oder knapp davor
    base = 90;
    label = "Abstiegskampf";
    const gap = team.points - safeLinePts;
    detail =
      pos > N - RELEGATION_SPOTS
        ? `Platz ${pos}/${N}, ${Math.abs(gap)} Punkte hinter dem rettenden Ufer`
        : `Platz ${pos}/${N}, nur ${Math.max(0, gap)} Punkte Vorsprung auf die Abstiegszone`;
  } else if (pos === 1 || (leaderPts - team.points <= maxSwing && pos <= 3)) {
    base = 82;
    label = "Titelkampf";
    detail = pos === 1 ? `Tabellenführer` : `Platz ${pos}, ${leaderPts - team.points} Punkte hinter der Spitze`;
  } else if (pos <= CL_SPOTS) {
    base = 62;
    label = "Champions-League-Rang";
    detail = `Platz ${pos}, verteidigt einen Champions-League-Platz`;
  } else if (clLinePts - team.points <= maxSwing && pos <= EUROPE_SPOTS + 2) {
    base = 55;
    label = "Kampf um Europa";
    detail = `Platz ${pos}, ${Math.max(0, clLinePts - team.points)} Punkte hinter den Champions-League-Plätzen`;
  } else {
    base = 28;
    label = "Mittelfeld";
    detail = `Platz ${pos}/${N}, ohne akutes Saisonziel`;
  }

  // Enge Situationen (kleine Abstände relativ zu Restspielen) verstärken.
  const tightness = maxSwing > 0 ? Math.max(0, 1 - Math.min(1, Math.abs(team.points - safeLinePts) / maxSwing)) : 0;
  const score = Math.round(Math.min(100, base * urgency + (label === "Abstiegskampf" ? tightness * 10 : 0)));

  return { score, label, reason: `${label}: ${detail}, ${remaining} Spiele offen.` };
}
