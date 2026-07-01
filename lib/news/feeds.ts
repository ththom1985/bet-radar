// Kostenlose Fußball-News-RSS-Feeds (kein Key, keine Limits).
export const FEEDS: { url: string; source: string }[] = [
  { url: "https://feeds.bbci.co.uk/sport/football/rss.xml", source: "BBC Sport" },
  { url: "https://www.theguardian.com/football/rss", source: "The Guardian" },
  { url: "https://www.skysports.com/rss/12040", source: "Sky Sports" },
  { url: "https://www.espn.com/espn/rss/soccer/news", source: "ESPN" },
];

// Bekannte Alias-Namen, damit News-Filter auch "Spurs", "Man Utd" etc. treffen.
const ALIASES: Record<string, string[]> = {
  "Tottenham": ["Tottenham", "Spurs"],
  "Manchester United": ["Manchester United", "Man Utd", "Man United"],
  "Manchester City": ["Manchester City", "Man City"],
  "Wolverhampton Wanderers": ["Wolves", "Wolverhampton"],
  "Wolverhampton": ["Wolves", "Wolverhampton"],
  "Newcastle United": ["Newcastle"],
  "West Ham United": ["West Ham"],
  "Brighton": ["Brighton"],
  "Nottingham Forest": ["Nottingham Forest", "Forest"],
  "Paris Saint-Germain": ["Paris Saint-Germain", "PSG"],
  "Bayern München": ["Bayern", "Bayern Munich"],
  "Borussia Dortmund": ["Dortmund"],
  "Borussia Mönchengladbach": ["Gladbach", "Monchengladbach"],
  "Inter Mailand": ["Inter Milan", "Inter"],
  "AC Mailand": ["AC Milan", "Milan"],
  "Juventus Turin": ["Juventus", "Juve"],
  "SSC Neapel": ["Napoli"],
  "AS Rom": ["Roma"],
  "Lazio Rom": ["Lazio"],
  "AC Florenz": ["Fiorentina"],
  "FC Barcelona": ["Barcelona", "Barca"],
  "Atlético Madrid": ["Atletico", "Atlético"],
  "Athletic Bilbao": ["Athletic Bilbao", "Athletic Club"],
};

/** Stichwörter, mit denen News einem Team zugeordnet werden. */
export function teamKeywords(name: string): string[] {
  if (ALIASES[name]) return ALIASES[name];
  // Sonst: bereinigter Name + markantestes Wort.
  const cleaned = name.replace(/\b(FC|CF|SC|AC|SS|AS|SSC|VfL|VfB|1\.|Club)\b/gi, "").trim();
  const words = cleaned.split(/\s+/).filter((w) => w.length >= 4);
  const keys = new Set<string>([cleaned]);
  if (words.length) keys.add(words[0]);
  return [...keys].filter((k) => k.length >= 3);
}
