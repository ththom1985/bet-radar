// Client für tennis-data.co.uk — freie ATP/WTA-Ergebnisse (+ Belag, Quoten) als Excel.
// ATP: /{year}/{year}.xlsx , WTA: /{year}w/{year}.xlsx
import * as XLSX from "xlsx";

export type TennisMatch = {
  winner: string; // "Sinner J."
  loser: string;
  surface: string; // Hard | Clay | Grass
  date: Date;
};

type Row = {
  Winner?: string;
  Loser?: string;
  Surface?: string;
  Date?: unknown;
};

function toDate(v: unknown): Date {
  if (v instanceof Date) return v;
  if (typeof v === "number") return new Date(Date.UTC(1899, 11, 30) + v * 86400000); // Excel-Seriennummer
  return new Date(String(v));
}

export async function fetchTennisMatches(tour: "atp" | "wta", year: number): Promise<TennisMatch[]> {
  const path = tour === "atp" ? `${year}/${year}.xlsx` : `${year}w/${year}.xlsx`;
  const res = await fetch(`http://www.tennis-data.co.uk/${path}`);
  if (!res.ok) throw new Error(`tennis-data ${tour} ${year}: ${res.status}`);
  const wb = XLSX.read(new Uint8Array(await res.arrayBuffer()), { type: "array", cellDates: true });
  const rows = XLSX.utils.sheet_to_json<Row>(wb.Sheets[wb.SheetNames[0]]);
  return rows
    .filter((r) => r.Winner && r.Loser)
    .map((r) => ({
      winner: String(r.Winner).trim(),
      loser: String(r.Loser).trim(),
      surface: (r.Surface as string) || "Hard",
      date: toDate(r.Date),
    }))
    .filter((m) => !isNaN(m.date.getTime()));
}
