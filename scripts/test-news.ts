import { loadAllNews, getRelevantNews } from "../lib/news/fetchNews";
async function main() {
  const all = await loadAllNews();
  console.log(`Geladene News-Items gesamt: ${all.length}`);
  for (const teams of [["Newcastle United", "Liverpool"], ["Tottenham", "Brentford"], ["Manchester City", "Bournemouth"]]) {
    const rel = await getRelevantNews(teams);
    console.log(`\n[${teams.join(" vs ")}] → ${rel.length} relevante Meldungen:`);
    for (const r of rel.slice(0, 4)) console.log(`  • (${r.source}) ${r.title}`);
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
