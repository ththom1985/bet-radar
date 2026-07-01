import { getTopValueBets, getStats } from "@/lib/queries";
import { pct, odds, edgePct, dateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [bets, stats] = await Promise.all([getTopValueBets(10), getStats()]);

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-2xl font-semibold">Top Value-Wetten</h1>
        <p className="text-white/50 mt-1 text-sm">
          Spiele, bei denen unser Poisson-Modell eine höhere Gewinnchance sieht als die Quote
          hergibt (Quote ≥ 1,80). Sortiert nach erwartetem Vorteil.
        </p>
      </section>

      <section className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Stat label="Ligen" value={stats.leagues} />
        <Stat label="Teams" value={stats.teams} />
        <Stat label="Anstehende Spiele" value={stats.upcoming} />
        <Stat label="Ergebnisse (Historie)" value={stats.finished} />
        <Stat label="Value-Wetten" value={stats.valueBets} highlight />
      </section>

      {bets.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-white/5 p-8 text-center text-white/50">
          Aktuell keine Value-Wetten. Führe den Datenabgleich und das Modell aus
          (<code className="text-white/70">npm run seed</code> ·{" "}
          <code className="text-white/70">npm run predict</code>).
        </div>
      ) : (
        <section className="space-y-3">
          {bets.map((b, i) => (
            <article
              key={`${b.fixtureId}-${b.selection}`}
              className="rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] transition-colors p-4"
            >
            <div className="flex flex-col md:flex-row md:items-center gap-4">
              <div className="flex items-center gap-3 md:w-[46%]">
                <span className="text-white/30 font-mono text-sm w-6 text-right">{i + 1}</span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs px-2 py-0.5 rounded bg-white/10 text-white/60">
                      {b.league}
                    </span>
                    <span className="text-xs text-white/40">{dateTime(b.kickoff)}</span>
                  </div>
                  <div className="font-medium mt-1">
                    {b.homeTeam} <span className="text-white/30">vs</span> {b.awayTeam}
                  </div>
                </div>
              </div>

              <div className="md:w-[22%]">
                <div className="text-emerald-300 font-medium">{b.selectionLabel}</div>
                <div className="text-xs text-white/40">bei {b.bookmaker}</div>
              </div>

              <div className="flex items-center gap-5 md:ml-auto">
                <Metric label="Modell" value={pct(b.modelProb)} />
                <Metric label="Quote sagt" value={pct(b.impliedProb)} muted />
                <Metric label="Quote" value={odds(b.bestOdds)} />
                <div className="text-right">
                  <div className="text-[11px] uppercase tracking-wide text-white/40">Vorteil</div>
                  <div className="text-lg font-semibold text-emerald-400">{edgePct(b.edge)}</div>
                </div>
              </div>
            </div>

            {b.reasoning && (
              <div className="mt-3 pt-3 border-t border-white/10 text-sm text-white/70 leading-relaxed">
                <span className="text-emerald-400/80 font-medium">Analyse: </span>
                {b.reasoning}
              </div>
            )}
            </article>
          ))}
        </section>
      )}
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        highlight ? "border-emerald-500/30 bg-emerald-500/10" : "border-white/10 bg-white/[0.03]"
      }`}
    >
      <div className={`text-2xl font-semibold ${highlight ? "text-emerald-300" : ""}`}>{value}</div>
      <div className="text-xs text-white/50 mt-1">{label}</div>
    </div>
  );
}

function Metric({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="text-right">
      <div className="text-[11px] uppercase tracking-wide text-white/40">{label}</div>
      <div className={`font-medium ${muted ? "text-white/50" : ""}`}>{value}</div>
    </div>
  );
}
