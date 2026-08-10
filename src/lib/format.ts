export function money(n: number, digits = 2): string {
  if (!isFinite(n) || n === 0) return "$0";
  if (Math.abs(n) >= 10000) return `$${(n / 1000).toFixed(1)}k`;
  return `$${n.toFixed(digits)}`;
}

export function int(n: number): string {
  if (!isFinite(n)) return "0";
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 10_000) return `${(n / 1000).toFixed(1)}k`;
  return Math.round(n).toLocaleString("en-US");
}

export function pct(n: number, digits = 2): string {
  if (!isFinite(n)) return "0%";
  return `${(n * 100).toFixed(digits)}%`;
}

export function mult(n: number): string {
  if (!isFinite(n)) return "0x";
  return `${n.toFixed(2)}x`;
}

export function hours(h: number): string {
  const d = Math.floor(h / 24);
  const r = h % 24;
  if (d === 0) return `${r}h`;
  return `${d}d ${r}h`;
}

export function clock(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
}
