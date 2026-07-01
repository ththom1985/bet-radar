// Normalisierung von Vereinsnamen für den Abgleich über Quellen hinweg
// (OpenLigaDB "FC Bayern München" ↔ API-Football "Bayern München" usw.).

// Füllwörter/Kürzel, die je nach Quelle mal dabei sind, mal nicht.
// "real" bewusst NICHT dabei (unterscheidend: Real Madrid vs Real Sociedad).
const FILLER =
  /\b(fc|sc|sv|vfb|vfl|tsg|tsv|sg|afc|us|ac|as|ss|ssc|cf|ud|rc|cd|ogc|rcd|calcio|club|de|del|olympique|racing|stade|1)\b/g;

export function normalizeClub(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // Akzente entfernen
    .replace(FILLER, "")
    .replace(/[^a-z]/g, ""); // Ziffern, Punkte, Leerzeichen entfernen
}
