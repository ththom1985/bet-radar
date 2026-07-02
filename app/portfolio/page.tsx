import { getPortfolio } from "@/lib/paper";
import { dateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

const eur = (x: number) => `${x >= 0 ? "" : "−"}${Math.abs(x).toFixed(2)} €`;

export default async function PortfolioPage() {
  const p = await getPortfolio();
  const up = p.netPL >= 0;

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-2xl font-semibold">Paper-Trading-Tracker</h1>
        <p className="text-white/50 mt-1 text-sm">
          Simuliert automatisch {eur(p.stake)} pro Tipp mit einem Vorteil ab{" "}
          {(p.edgeThreshold * 100).toFixed(0)}%, ausgehend von {eur(p.initial)} Startkapital.
          Inklusive {(p.taxRate * 100).toFixed(0)}% Wettsteuer auf den Umsatz.
        </p>
      </section>

      <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-2.5 text-xs text-amber-200/80">
        ⚠️ Simulation — <strong>kein echtes Geld</strong>, keine echten Wetten. Zeigt nur, wie sich
        die Tipps <em>hypothetisch</em> entwickeln würden.
      </div>

      {/* Bankroll + Kurve */}
      <section className="rounded-xl border border-white/10 bg-white/[0.03] p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-wide text-white/40">Bankroll (virtuell)</div>
            <div className={`text-4xl font-semibold ${up ? "text-emerald-300" : "text-red-300"}`}>
              {eur(p.bankroll)}
            </div>
            <div className={`text-sm mt-1 ${up ? "text-emerald-400" : "text-red-400"}`}>
              {up ? "▲" : "▼"} {eur(p.netPL)} netto ({p.roi >= 0 ? "+" : ""}
              {(p.roi * 100).toFixed(1)}% ROI)
            </div>
          </div>
          <Sparkline points={p.equity.map((e) => e.bankroll)} baseline={p.initial} />
        </div>
      </section>

      {/* Kennzahlen */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Metric label="Umsatz (Einsätze)" value={eur(p.turnover)} />
        <Metric label="Rückfluss" value={eur(p.returns)} />
        <Metric label={`Wettsteuer (${(p.taxRate * 100).toFixed(0)}%)`} value={"−" + eur(p.tax).replace("−", "")} negative />
        <Metric label="Brutto vor Steuer" value={eur(p.grossPL)} />
        <Metric label="Abgerechnet" value={`${p.settledCount}`} />
        <Metric label="Trefferquote" value={`${(p.hitRate * 100).toFixed(0)}%`} />
        <Metric label="Offene Wetten" value={`${p.openCount}`} />
        <Metric label="Offener Einsatz" value={eur(p.openStake)} />
      </section>

      {/* Offene Wetten */}
      <section>
        <h2 className="text-lg font-medium mb-3">Offene Wetten ({p.openCount})</h2>
        {p.openBets.length === 0 ? (
          <p className="text-white/40 text-sm">Keine offenen Wetten.</p>
        ) : (
          <div className="rounded-xl border border-white/10 overflow-hidden divide-y divide-white/5">
            {p.openBets.map((b, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-white/[0.03]">
                <span className="text-xs px-2 py-0.5 rounded bg-white/10 text-white/50 w-32 truncate">{b.league}</span>
                <span className="flex-1 truncate">{b.match}</span>
                <span className="text-emerald-300">{b.pick}</span>
                <span className="font-mono text-white/60 w-14 text-right">{b.odds.toFixed(2)}</span>
                <span className="text-xs text-white/30 w-28 text-right hidden md:block">{dateTime(b.kickoff)}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Zuletzt abgerechnet */}
      {p.recent.length > 0 && (
        <section>
          <h2 className="text-lg font-medium mb-3">Zuletzt abgerechnet</h2>
          <div className="rounded-xl border border-white/10 overflow-hidden divide-y divide-white/5">
            {p.recent.map((b, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                <span className={`w-2 h-2 rounded-full ${b.won ? "bg-emerald-400" : "bg-red-400"}`} />
                <span className="flex-1 truncate">{b.match}</span>
                <span className="text-white/50">{b.pick}</span>
                <span className="font-mono text-white/40 w-12 text-right">{b.score}</span>
                <span className={`w-16 text-right font-medium ${b.won ? "text-emerald-400" : "text-red-400"}`}>
                  {b.won ? "gewonnen" : "verloren"}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function Metric({ label, value, negative }: { label: string; value: string; negative?: boolean }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <div className={`text-xl font-semibold ${negative ? "text-red-300" : ""}`}>{value}</div>
      <div className="text-xs text-white/50 mt-1">{label}</div>
    </div>
  );
}

function Sparkline({ points, baseline }: { points: number[]; baseline: number }) {
  if (points.length < 2) return <div className="text-xs text-white/30">Noch kein Verlauf</div>;
  const w = 280, h = 70;
  const min = Math.min(...points, baseline);
  const max = Math.max(...points, baseline);
  const range = max - min || 1;
  const x = (i: number) => (i / (points.length - 1)) * w;
  const y = (v: number) => h - ((v - min) / range) * h;
  const path = points.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const last = points[points.length - 1];
  const up = last >= baseline;
  return (
    <svg width={w} height={h} className="overflow-visible">
      <line x1="0" y1={y(baseline)} x2={w} y2={y(baseline)} stroke="rgba(255,255,255,0.15)" strokeDasharray="3 3" />
      <path d={path} fill="none" stroke={up ? "#34d399" : "#f87171"} strokeWidth="2" />
    </svg>
  );
}
