// Die 5 europäischen Topligen (erste Divisionen).
// apiFootballId = Liga-ID bei API-Football (v3).
// oddsApiKey    = Sport-Key bei The Odds API.
// season        = Startjahr der Saison (2025 = Saison 2025/26).

export type LeagueConfig = {
  name: string;
  country: string;
  apiFootballId: number;
  oddsApiKey: string;
};

export const LEAGUES: LeagueConfig[] = [
  {
    name: "Bundesliga",
    country: "Deutschland",
    apiFootballId: 78,
    oddsApiKey: "soccer_germany_bundesliga",
  },
  {
    name: "Premier League",
    country: "England",
    apiFootballId: 39,
    oddsApiKey: "soccer_epl",
  },
  {
    name: "La Liga",
    country: "Spanien",
    apiFootballId: 140,
    oddsApiKey: "soccer_spain_la_liga",
  },
  {
    name: "Serie A",
    country: "Italien",
    apiFootballId: 135,
    oddsApiKey: "soccer_italy_serie_a",
  },
  {
    name: "Ligue 1",
    country: "Frankreich",
    apiFootballId: 61,
    oddsApiKey: "soccer_france_ligue_one",
  },
];

// Standard-Saison, aus der historische Ergebnisse für das Modell kommen.
// Vor Saisonstart (Sommer) nutzen wir die gerade beendete Saison.
export const DEFAULT_SEASON = 2025;
