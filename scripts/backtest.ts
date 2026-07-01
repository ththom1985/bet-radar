// Backtest: Prüft ehrlich, ob das Modell über echte Saisons einen Vorteil hätte —
// und vergleicht zwei Modell-Varianten direkt:
//   (A) "Tore"      — Stärken aus tatsächlichen Toren (Basismodell)
//   (B) "Schüsse"    — Stärken aus Torschüssen aufs Tor (Shots on Target) als xG-Ersatz
//                      (Chancenqualität statt Glück), Skala aber weiter an echten Toren verankert
//
// Datenquelle: Football-Data.co.uk (gratis, Ergebnisse + Schüsse + Schlussquoten, kein Key).
// Methode ohne Look-ahead: Stärken aus Saison N → auf Saison N+1 wetten (out-of-sample).
//
// Aufruf: npm run backtest

import { matchProbabilities } from "../lib/model/poisson";
import { findValue } from "../lib/model/value";

const DIVS: Record<string, string> = {
  "Premier League": "E0",
  Bundesliga: "D1",
  "Serie A": "I1",
  "La Liga": "SP1",
  "Ligue 1": "F1",
};

const PAIRS: [string, string][] = [
  ["2122", "2223"],
  ["2223", "2324"],
  ["2324", "2425"],
];

const MIN_ODDS = 1.8;
const MIN_EDGE = 0.05;
const MIN_HISTORY = 10;
const K = 6; // Shrinkage

type Row = Record<string, string>;

async function fetchCsv(season: string, div: string): Promise<Row[]> {
  const url = `https://www.football-data.co.uk/mmz4281/${season}/${div}.csv`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  const text = await res.text();
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const header = lines[0].split(",");
  const rows: Row[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(",");
    const row: Row = {};
    header.forEach((h, j) => (row[h.trim()] = (cells[j] ?? "").trim()));
    if (row["HomeTeam"] && row["FTHG"] !== "") rows.push(row);
  }
  return rows;
}

function getOdds(row: Row): { home: number; draw: number; away: number } | null {
  const triples = [
    ["MaxCH", "MaxCD", "MaxCA"], // beste Schlussquote über alle Buchmacher (Line-Shopping)
    ["MaxH", "MaxD", "MaxA"], // beste Quote (pre-match)
    ["AvgCH", "AvgCD", "AvgCA"],
    ["PSCH", "PSCD", "PSCA"],
    ["B365CH", "B365CD", "B365CA"],
    ["AvgH", "AvgD", "AvgA"],
    ["B365H", "B365D", "B365A"],
    ["PSH", "PSD", "PSA"],
  ];
  for (const [h, d, a] of triples) {
    const oh = parseFloat(row[h]);
    const od = parseFloat(row[d]);
    const oa = parseFloat(row[a]);
    if (oh > 1 && od > 1 && oa > 1) return { home: oh, draw: od, away: oa };
  }
  return null;
}

// Prüft, ob eine Zeile für BEIDE Modelle taugt (Tore + Schüsse aufs Tor vorhanden).
function usable(r: Row): boolean {
  return (
    r["FTHG"] !== "" && r["FTAG"] !== "" && !isNaN(parseFloat(r["HST"])) && !isNaN(parseFloat(r["AST"]))
  );
}

type Strengths = {
  atkHome: Map<string, number>;
  defHome: Map<string, number>;
  atkAway: Map<string, number>;
  defAway: Map<string, number>;
  hist: Map<string, number>;
  leagueGoalHome: number;
  leagueGoalAway: number;
};

// Baut Stärken aus einer beliebigen "Chancen-Metrik" (Tore ODER Schüsse aufs Tor),
// verankert die Skala aber immer an den echten Toren.
function buildStrengths(rows: Row[], home: (r: Row) => number, away: (r: Row) => number): Strengths {
  const n = rows.length;
  const leagueMetricHome = rows.reduce((s, r) => s + home(r), 0) / n;
  const leagueMetricAway = rows.reduce((s, r) => s + away(r), 0) / n;
  const leagueGoalHome = rows.reduce((s, r) => s + parseInt(r["FTHG"], 10), 0) / n;
  const leagueGoalAway = rows.reduce((s, r) => s + parseInt(r["FTAG"], 10), 0) / n;

  type Acc = { hs: number; hc: number; hg: number; as: number; ac: number; ag: number };
  const acc = new Map<string, Acc>();
  const ens = (t: string) => {
    let a = acc.get(t);
    if (!a) acc.set(t, (a = { hs: 0, hc: 0, hg: 0, as: 0, ac: 0, ag: 0 }));
    return a;
  };
  for (const r of rows) {
    const h = ens(r["HomeTeam"]);
    h.hs += home(r);
    h.hc += away(r);
    h.hg++;
    const a = ens(r["AwayTeam"]);
    a.as += away(r);
    a.ac += home(r);
    a.ag++;
  }

  const shrink = (raw: number, g: number) => (g * raw + K) / (g + K);
  const s: Strengths = {
    atkHome: new Map(),
    defHome: new Map(),
    atkAway: new Map(),
    defAway: new Map(),
    hist: new Map(),
    leagueGoalHome,
    leagueGoalAway,
  };
  for (const [t, a] of acc) {
    s.atkHome.set(t, shrink(a.hg ? a.hs / a.hg / leagueMetricHome : 1, a.hg));
    s.defHome.set(t, shrink(a.hg ? a.hc / a.hg / leagueMetricAway : 1, a.hg));
    s.atkAway.set(t, shrink(a.ag ? a.as / a.ag / leagueMetricAway : 1, a.ag));
    s.defAway.set(t, shrink(a.ag ? a.ac / a.ag / leagueMetricHome : 1, a.ag));
    s.hist.set(t, a.hg + a.ag);
  }
  return s;
}

function expGoals(s: Strengths, home: string, away: string) {
  const ah = s.atkHome.get(home) ?? 1;
  const dh = s.defHome.get(home) ?? 1;
  const aa = s.atkAway.get(away) ?? 1;
  const da = s.defAway.get(away) ?? 1;
  return { eh: ah * da * s.leagueGoalHome, ea: aa * dh * s.leagueGoalAway };
}

type Tally = { bets: number; wins: number; staked: number; returned: number };
const newTally = (): Tally => ({ bets: 0, wins: 0, staked: 0, returned: 0 });
const roi = (t: Tally) => (t.staked ? (((t.returned - t.staked) / t.staked) * 100).toFixed(1) + "%" : "–");
const hit = (t: Tally) => (t.bets ? ((t.wins / t.bets) * 100).toFixed(1) + "%" : "–");

const goalsHome = (r: Row) => parseInt(r["FTHG"], 10);
const goalsAway = (r: Row) => parseInt(r["FTAG"], 10);
const sotHome = (r: Row) => parseFloat(r["HST"]);
const sotAway = (r: Row) => parseFloat(r["AST"]);

function betOne(s: Strengths, r: Row, t: Tally, total: Tally) {
  const home = r["HomeTeam"], away = r["AwayTeam"];
  if ((s.hist.get(home) ?? 0) < MIN_HISTORY || (s.hist.get(away) ?? 0) < MIN_HISTORY) return;
  const odds = getOdds(r);
  if (!odds) return;
  const { eh, ea } = expGoals(s, home, away);
  const probs = matchProbabilities(eh, ea);
  const result = r["FTR"];
  for (const c of findValue(probs, odds, { minOdds: MIN_ODDS, minEdge: MIN_EDGE })) {
    const won =
      (c.selection === "HOME" && result === "H") ||
      (c.selection === "DRAW" && result === "D") ||
      (c.selection === "AWAY" && result === "A");
    for (const acc of [t, total]) {
      acc.bets++;
      acc.staked += 1;
      if (won) {
        acc.wins++;
        acc.returned += c.odds;
      }
    }
  }
}

async function main() {
  console.log("Backtest — Modellvergleich vs. Schlussquoten (out-of-sample)\n");
  const totGoals = newTally(), totSot = newTally();

  for (const [name, div] of Object.entries(DIVS)) {
    const lgGoals = newTally(), lgSot = newTally();
    for (const [trainS, testS] of PAIRS) {
      let train: Row[], test: Row[];
      try {
        [train, test] = await Promise.all([fetchCsv(trainS, div), fetchCsv(testS, div)]);
      } catch {
        continue;
      }
      train = train.filter(usable);
      test = test.filter(usable);
      if (train.length < 50) continue;

      const sGoals = buildStrengths(train, goalsHome, goalsAway);
      const sSot = buildStrengths(train, sotHome, sotAway);
      for (const r of test) {
        betOne(sGoals, r, lgGoals, totGoals);
        betOne(sSot, r, lgSot, totSot);
      }
    }
    console.log(
      `${name.padEnd(15)} | Tore: ${String(lgGoals.bets).padStart(4)} Wetten, ROI ${roi(lgGoals).padStart(7)}` +
        ` | Schüsse: ${String(lgSot.bets).padStart(4)} Wetten, ROI ${roi(lgSot).padStart(7)}`
    );
  }

  console.log("\n" + "─".repeat(78));
  console.log(
    `GESAMT Tore   : ${String(totGoals.bets).padStart(4)} Wetten · Trefferquote ${hit(totGoals)} · ROI ${roi(totGoals)} · P/L ${(totGoals.returned - totGoals.staked).toFixed(1)}`
  );
  console.log(
    `GESAMT Schüsse: ${String(totSot.bets).padStart(4)} Wetten · Trefferquote ${hit(totSot)} · ROI ${roi(totSot)} · P/L ${(totSot.returned - totSot.staked).toFixed(1)}`
  );
  console.log("\nBesserer ROI = das Modell hätte auf diesen Daten weniger verloren / mehr gewonnen.");
  console.log("Ein Lauf ist kein Beweis (Varianz). Beide gegen die harte Schlussquoten-Benchmark.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
