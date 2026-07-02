// Normalisiert Tennis-Spielernamen über die Quellen hinweg:
// tennis-data.co.uk "Sinner J." (Nachname Initiale) ↔ Odds API "Jannik Sinner" (Vor Nach).
// Schlüssel = nachname|initiale, damit beide Formate zusammenfinden.

function clean(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z]/g, "");
}

export function normalizePlayer(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  const last = parts[parts.length - 1];

  // "Sinner J." / "Auger-Aliassime F." → letzte Token ist die Initiale
  if (/^[A-Za-z]\.?$/.test(last) && parts.length >= 2) {
    const surname = clean(parts.slice(0, -1).join(""));
    return `${surname}|${clean(last)[0] ?? ""}`;
  }
  // "Jannik Sinner" → letzter Token ist der Nachname, erster liefert die Initiale
  const surname = clean(last);
  const initial = clean(parts[0])[0] ?? "";
  return `${surname}|${initial}`;
}
