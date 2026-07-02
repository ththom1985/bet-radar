import { getEloRanking } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function RankingPage() {
  const ranking = await getEloRanking();
  const max = ranking[0]?.rating ?? 1;
  const min = ranking[ranking.length - 1]?.rating ?? 0;

  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-2xl font-semibold">Elo-Weltrangliste</h1>
        <p className="text-white/50 mt-1 text-sm">
          Stärke der Nationalmannschaften auf einer gemeinsamen Skala, berechnet aus Länderspielen
          (WM, EM, Nations League, Copa América, Afrika-Cup, Freundschaftsspiele) inklusive der
          laufenden WM 2026. Höher = stärker.
        </p>
      </section>

      {ranking.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-white/5 p-8 text-center text-white/50">
          Noch keine Rangliste. Führe <code className="text-white/70">npm run intl</code> aus.
        </div>
      ) : (
        <div className="rounded-xl border border-white/10 overflow-hidden">
          {ranking.map((r, i) => {
            const width = max > min ? ((r.rating - min) / (max - min)) * 100 : 100;
            return (
              <div
                key={r.team}
                className="flex items-center gap-4 px-4 py-2.5 border-b border-white/5 last:border-0 hover:bg-white/[0.03]"
              >
                <span className="w-6 text-right font-mono text-sm text-white/40">{i + 1}</span>
                <span className="w-44 font-medium truncate">{r.team}</span>
                <div className="flex-1 h-2 rounded-full bg-white/5 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-emerald-400"
                    style={{ width: `${Math.max(4, width)}%` }}
                  />
                </div>
                <span className="w-14 text-right font-mono font-semibold text-emerald-300">
                  {r.rating}
                </span>
                <span className="w-16 text-right text-xs text-white/30">{r.games} Sp.</span>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-xs text-white/30">
        Hinweis: Die Bewertung basiert auf freien Daten (2022–2026) und endet bei der Aktualität der
        Quellen. Sie ist ein Analyse-Wert, keine offizielle Rangliste.
      </p>
    </div>
  );
}
