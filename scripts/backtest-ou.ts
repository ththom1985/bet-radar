// Backtest für ÜBER/UNTER 2,5 Tore: testet, ob im Totals-Markt mehr Value steckt als im 1X2.
// Modell: Poisson-Torverteilung (Gesamttore ~ Poisson(λ_home+λ_away)) vs. echte Ü/U-Schlussquoten.
// Datenquelle: Football-Data.co.uk (gratis). Aufruf: npm run backtest:ou

import { poissonProbability } from "../lib/model/poisson";
import { findValueTwoWay } from "../lib/model/value";

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
const K = 6;

type Row = Record<string, string>;

async function fetchCsv(season: string, div: string): Promise<Row[]> {
  const res = await fetch(`https://www.football-data.co.uk/mmz4281/${season}/${div}.csv`);
  if (!res.ok) throw new Error(`${res.status}`);
  const lines = (await res.text()).split(/\r?\n/).filter((l) => l.trim());
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

function ouOdds(row: Row): { over: number; under: number } | null {
  const pairs = [
    ["MaxC>2.5", "MaxC<2.5"], // beste Schlussquote (Line-Shopping)
    ["AvgC>2.5", "AvgC<2.5"],
    ["PC>2.5", "PC<2.5"],
    ["Max>2.5", "Max<2.5"],
    ["Avg>2.5", "Avg<2.5"],
    ["B365>2.5", "B365<2.5"],
  ];
  for (const [o, u] of pairs) {
    const oo = parseFloat(row[o]);
    const uu = parseFloat(row[u]);
    if (oo > 1 && uu > 1) return { over: oo, under: uu };
  }
  return null;
}

// Tor-Stärken (wie im 1X2-Backtest, mit Shrinkage) → erwartete Tore je Team.
type Str = { atkH: Map<string, number>; defH: Map<string, number>; atkA: Map<string, number>; defA: Map<string, number>; hist: Map<string, number>; lgH: number; lgA: number };
function buildStrengths(rows: Row[]): Str {
  const n = rows.length;
  const lgH = rows.reduce((s, r) => s + +r["FTHG"], 0) / n;
  const lgA = rows.reduce((s, r) => s + +r["FTAG"], 0) / n;
  type Acc = { hs: number; hc: number; hg: number; as: number; ac: number; ag: number };
  const acc = new Map<string, Acc>();
  const ens = (t: string) => { let a = acc.get(t); if (!a) acc.set(t, (a = { hs: 0, hc: 0, hg: 0, as: 0, ac: 0, ag: 0 })); return a; };
  for (const r of rows) {
    const h = ens(r["HomeTeam"]); h.hs += +r["FTHG"]; h.hc += +r["FTAG"]; h.hg++;
    const a = ens(r["AwayTeam"]); a.as += +r["FTAG"]; a.ac += +r["FTHG"]; a.ag++;
  }
  const sh = (raw: number, g: number) => (g * raw + K) / (g + K);
  const s: Str = { atkH: new Map(), defH: new Map(), atkA: new Map(), defA: new Map(), hist: new Map(), lgH, lgA };
  for (const [t, a] of acc) {
    s.atkH.set(t, sh(a.hg ? a.hs / a.hg / lgH : 1, a.hg));
    s.defH.set(t, sh(a.hg ? a.hc / a.hg / lgA : 1, a.hg));
    s.atkA.set(t, sh(a.ag ? a.as / a.ag / lgA : 1, a.ag));
    s.defA.set(t, sh(a.ag ? a.ac / a.ag / lgH : 1, a.ag));
    s.hist.set(t, a.hg + a.ag);
  }
  return s;
}
function expGoals(s: Str, h: string, a: string) {
  return {
    eh: (s.atkH.get(h) ?? 1) * (s.defA.get(a) ?? 1) * s.lgH,
    ea: (s.atkA.get(a) ?? 1) * (s.defH.get(h) ?? 1) * s.lgA,
  };
}

async function main() {
  console.log("Backtest ÜBER/UNTER 2,5 — Poisson vs. echte Ü/U-Schlussquoten (Bestquote)\n");
  let bets = 0, wins = 0, staked = 0, returned = 0;
  const calib: { p: number; won: boolean }[] = [];

  for (const [name, div] of Object.entries(DIVS)) {
    let lb = 0, lw = 0, ls = 0, lr = 0;
    for (const [trainS, testS] of PAIRS) {
      let train: Row[], test: Row[];
      try { [train, test] = await Promise.all([fetchCsv(trainS, div), fetchCsv(testS, div)]); } catch { continue; }
      if (train.length < 50) continue;
      const s = buildStrengths(train);
      for (const r of test) {
        if ((s.hist.get(r["HomeTeam"]) ?? 0) < MIN_HISTORY || (s.hist.get(r["AwayTeam"]) ?? 0) < MIN_HISTORY) continue;
        const odds = ouOdds(r);
        if (!odds) continue;
        const { eh, ea } = expGoals(s, r["HomeTeam"], r["AwayTeam"]);
        const lambda = eh + ea;
        const pUnder = poissonProbability(0, lambda) + poissonProbability(1, lambda) + poissonProbability(2, lambda);
        const pOver = 1 - pUnder;
        const total = +r["FTHG"] + +r["FTAG"];
        // "HOME" = Über, "AWAY" = Unter
        for (const c of findValueTwoWay(pOver, pUnder, odds.over, odds.under, { minOdds: MIN_ODDS, minEdge: MIN_EDGE })) {
          const won = c.selection === "HOME" ? total >= 3 : total <= 2;
          calib.push({ p: c.modelProb, won });
          bets++; staked++; lb++; ls++;
          if (won) { wins++; returned += c.odds; lw++; lr += c.odds; }
        }
      }
    }
    const roi = ls ? (((lr - ls) / ls) * 100).toFixed(1) + "%" : "–";
    console.log(`${name.padEnd(15)} | ${String(lb).padStart(4)} Wetten, ROI ${roi.padStart(7)}`);
  }

  console.log("\n" + "─".repeat(60));
  const roi = staked ? (((returned - staked) / staked) * 100).toFixed(1) + "%" : "–";
  const hit = bets ? ((wins / bets) * 100).toFixed(1) + "%" : "–";
  console.log(`GESAMT Ü/U 2,5: ${bets} Wetten · Trefferquote ${hit} · ROI ${roi} · P/L ${(returned - staked).toFixed(1)}`);

  console.log("\nKALIBRIERUNG:");
  for (const [lo, hi] of [[0.33, 0.45], [0.45, 0.55], [0.55, 0.65], [0.65, 1.01]]) {
    const b = calib.filter((c) => c.p >= lo && c.p < hi);
    if (!b.length) continue;
    const pred = (b.reduce((s, c) => s + c.p, 0) / b.length) * 100;
    const act = (b.filter((c) => c.won).length / b.length) * 100;
    console.log(`  ${(lo * 100).toFixed(0)}–${(hi * 100 > 100 ? 100 : hi * 100).toFixed(0)}%: vorhergesagt ${pred.toFixed(1)}% · tatsächlich ${act.toFixed(1)}% (${(act - pred >= 0 ? "+" : "") + (act - pred).toFixed(1)}) · ${b.length}`);
  }
  console.log("\nVergleich: 1X2-Backtest lag bei ~-1,6% (Bestquote). Ist Ü/U besser?");
}

main().catch((e) => { console.error(e); process.exit(1); });
