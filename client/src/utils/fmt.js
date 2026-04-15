export function fmt(n) {
  const v = Math.round(Number(n) || 0);
  return "€" + v.toLocaleString("pt-PT");
}

export function fmtK(n) {
  const v = Number(n) || 0;
  if (Math.abs(v) >= 1000) return "€" + (v / 1000).toFixed(1) + "k";
  return "€" + Math.round(v);
}

export function pct(part, total) {
  if (!total) return 0;
  return Math.round((part / total) * 100);
}
