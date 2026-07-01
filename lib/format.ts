// Kleine Formatierungs-Helfer (deutsche Darstellung).

export function pct(x: number, digits = 0): string {
  return (x * 100).toFixed(digits) + "%";
}

export function odds(x: number): string {
  return x.toFixed(2);
}

export function edgePct(x: number): string {
  const sign = x >= 0 ? "+" : "";
  return sign + (x * 100).toFixed(1) + "%";
}

export function dateTime(d: Date): string {
  return new Intl.DateTimeFormat("de-DE", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}
