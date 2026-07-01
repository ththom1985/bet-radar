# Bet-Radar ⚽

Analyse-Dashboard für Fußball-Wetten in den 5 europäischen Topligen
(Bundesliga, Premier League, La Liga, Serie A, Ligue 1).

Das Tool zieht **Quoten** und **historische Ergebnisse** aus öffentlichen APIs,
berechnet mit einem **Poisson-Modell** eine eigene Wahrscheinlichkeit je Spiel und
zeigt an, wo das Modell optimistischer ist als der Buchmacher (**Value**).

## ⚠️ Ehrliche Einordnung — bitte lesen

Bet-Radar ist ein **Entscheidungs-Werkzeug, keine Gelddruckmaschine**.

- Buchmacher-Quoten sind sehr effizient und enthalten eine Marge (~5–7 %).
- Ein positiver „Value" heißt nur: *Das Modell hält die Wette für unterbewertet* —
  nicht, dass sie gewinnt. Ob das Modell recht hat, zeigt erst die Auswertung über
  **viele** Wetten (Backtesting).
- Setze niemals Geld ein, dessen Verlust du nicht verkraftest.

## Stack

Next.js 16 · TypeScript · Prisma · SQLite (lokal) / Neon-Postgres (Deploy) · Tailwind

## Schnellstart

```bash
npm install
npx prisma migrate dev      # legt die lokale DB an
npm run seed                # Demo-Daten (ohne API-Keys)
npm run predict             # Modell rechnen
npm run dev                 # http://localhost:3000
```

## Mit echten Daten (kostenlose API-Keys)

1. **API-Football** (Spiele, Ergebnisse): https://www.api-football.com/ → Key holen
2. **The Odds API** (Quoten): https://the-odds-api.com/ → Key holen
3. Keys in `.env` eintragen:
   ```
   API_FOOTBALL_KEY="dein-key"
   ODDS_API_KEY="dein-key"
   ```
4. Abgleich starten (holt echte Daten + rechnet Modell):
   ```bash
   npm run sync
   ```

> **Free-Tier schonen:** `npm run sync` möglichst nur **1×/Tag** laufen lassen
> (API-Football: 100 Requests/Tag, Odds API: 500/Monat).

## Struktur

```
lib/
  leagues.ts            Liga-Konfiguration (IDs der APIs)
  odds.ts               Quoten-Mathematik (implizite Wahrscheinlichkeit, Marge)
  predict.ts            Modell-Lauf über die DB
  clients/
    apiFootball.ts      Spiele/Ergebnisse
    oddsApi.ts          Quoten
  model/
    poisson.ts          Poisson-Wahrscheinlichkeiten (1X2)
    strengths.ts        Team-Stärken aus Historie → erwartete Tore
    value.ts            Value-Erkennung (Edge)
app/
  page.tsx              Top Value-Wetten
  matches/page.tsx      Alle anstehenden Spiele
scripts/
  seed.ts               Demo-Daten
  predict.ts            Modell-CLI
  sync.ts               Echter API-Abgleich
```

## Roadmap (nächste Ausbaustufen)

- [ ] Dixon-Coles-Korrektur für knappe Ergebnisse (0:0, 1:0 …)
- [ ] Form-Gewichtung (jüngste Spiele stärker als alte)
- [ ] Verletzungen/Sperren aus API-Football einbeziehen
- [ ] „Wichtigkeit des Spiels" (Tabellensituation) als Faktor
- [ ] Claude-Agent: News + Kontext gewichten, Value-Liste in Klartext begründen
- [ ] Backtesting: Trefferquote & Rendite des Modells über eine Saison messen
- [ ] Deployment auf Vercel + Neon-Postgres
