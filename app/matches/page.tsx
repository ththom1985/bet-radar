import { getUpcomingMatches } from "@/lib/queries";
import { pct, odds as fmtOdds, dateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function MatchesPage() {
  const matches = await getUpcomingMatches();

  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-2xl font-semibold">Anstehende Spiele</h1>
        <p className="text-white/50 mt-1 text-sm">
          Modell-Wahrscheinlichkeit (M) gegenüber der impliziten Wahrscheinlichkeit der Quote (Q)
          je Ausgang. Grün markiert = Modell sieht Value.
        </p>
      </section>

      <div className="overflow-x-auto rounded-xl border border-white/10">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-white/50 text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left font-medium px-4 py-3">Spiel</th>
              <th className="text-center font-medium px-3 py-3">Erw. Tore</th>
              <th className="text-center font-medium px-3 py-3">Heim (1)</th>
              <th className="text-center font-medium px-3 py-3">Remis (X)</th>
              <th className="text-center font-medium px-3 py-3">Auswärts (2)</th>
              <th className="text-center font-medium px-3 py-3">Value</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {matches.map((m) => {
              const val = valueFlags(m);
              return (
                <tr key={m.fixtureId} className="hover:bg-white/[0.03]">
                  <td className="px-4 py-3">
                    <div className="font-medium">
                      {m.homeTeam} <span className="text-white/30">vs</span> {m.awayTeam}
                    </div>
                    <div className="text-xs text-white/40">
                      {m.league} · {dateTime(m.kickoff)}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-center font-mono text-white/60">
                    {m.model ? `${m.model.expHomeGoals.toFixed(1)} : ${m.model.expAwayGoals.toFixed(1)}` : "–"}
                  </td>
                  <OutcomeCell
                    model={m.model?.pHome}
                    odd={m.odds?.home}
                    highlight={val.home}
                  />
                  <OutcomeCell
                    model={m.model?.pDraw}
                    odd={m.odds?.draw}
                    highlight={val.draw}
                  />
                  <OutcomeCell
                    model={m.model?.pAway}
                    odd={m.odds?.away}
                    highlight={val.away}
                  />
                  <td className="px-3 py-3 text-center">
                    {m.hasValue ? (
                      <span className="text-emerald-400">✓</span>
                    ) : (
                      <span className="text-white/20">–</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {matches.length === 0 && (
        <div className="text-center text-white/50 py-8">Keine anstehenden Spiele.</div>
      )}
    </div>
  );
}

// Markiert je Ausgang, ob das Modell Value sieht (Modellwahrscheinlichkeit × Quote > 1).
function valueFlags(m: Awaited<ReturnType<typeof getUpcomingMatches>>[number]) {
  const flag = (p?: number, o?: number) => (p != null && o != null ? p * o - 1 >= 0.05 && o >= 1.8 : false);
  return {
    home: flag(m.model?.pHome, m.odds?.home),
    draw: flag(m.model?.pDraw, m.odds?.draw),
    away: flag(m.model?.pAway, m.odds?.away),
  };
}

function OutcomeCell({
  model,
  odd,
  highlight,
}: {
  model?: number;
  odd?: number;
  highlight: boolean;
}) {
  return (
    <td className="px-3 py-3 text-center">
      <div
        className={`inline-flex flex-col rounded-md px-2 py-1 ${
          highlight ? "bg-emerald-500/15 ring-1 ring-emerald-500/30" : ""
        }`}
      >
        <span className="font-mono">{odd != null ? fmtOdds(odd) : "–"}</span>
        <span className="text-[11px] text-white/40">
          M {model != null ? pct(model) : "–"}
        </span>
      </div>
    </td>
  );
}
