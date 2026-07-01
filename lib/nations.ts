// Einheitliche Normalisierung von Nationalmannschafts-Namen über die Quellen hinweg
// (football-data.org, API-Football, The Odds API schreiben teils unterschiedlich).

function base(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[^a-z]/g, "");
}

// Kanonischer Name → alle bekannten Schreibweisen (als base-Form).
const ALIASES: Record<string, string[]> = {
  usa: ["usa", "unitedstates", "unitedstatesofamerica"],
  southkorea: ["southkorea", "korearepublic", "republicofkorea"],
  northkorea: ["northkorea", "koreadpr", "dprkorea"],
  bosnia: ["bosnia", "bosniaherzegovina", "bosniaandherzegovina"],
  turkey: ["turkey", "turkiye"],
  czechia: ["czechia", "czechrepublic"],
  iran: ["iran", "iriran", "islamicrepublicofiran"],
  ivorycoast: ["ivorycoast", "cotedivoire"],
  capeverde: ["capeverde", "caboverde"],
  drcongo: ["drcongo", "congodr", "democraticrepublicofthecongo", "congodemocraticrepublic"],
  congo: ["congo", "republicofthecongo"],
  uae: ["uae", "unitedarabemirates"],
  china: ["china", "chinapr"],
  ireland: ["ireland", "republicofireland"],
};

// Rückwärts-Index: base-Form → kanonisch.
const CANON = new Map<string, string>();
for (const [canon, variants] of Object.entries(ALIASES)) {
  for (const v of variants) CANON.set(v, canon);
}

export function normalizeNation(name: string): string {
  const b = base(name);
  return CANON.get(b) ?? b;
}
