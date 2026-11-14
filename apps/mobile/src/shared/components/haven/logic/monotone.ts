type Pt = [number, number];

function sign(n: number) {
  return n < 0 ? -1 : 1;
}

function slopes(p: Pt[]): number[] {
  const n = p.length;
  const m = new Array<number>(n).fill(0);
  if (n < 2) return m;
  const d: number[] = [];
  const h: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    h[i] = p[i + 1][0] - p[i][0] || 1e-9;
    d[i] = (p[i + 1][1] - p[i][1]) / h[i];
  }
  for (let i = 1; i < n - 1; i++) {
    const s0 = d[i - 1];
    const s1 = d[i];
    const pp = (s0 * h[i] + s1 * h[i - 1]) / (h[i - 1] + h[i]);
    m[i] = (sign(s0) + sign(s1)) * Math.min(Math.abs(s0), Math.abs(s1), 0.5 * Math.abs(pp)) || 0;
  }
  m[0] = n > 2 ? (3 * d[0] - m[1]) / 2 : d[0];
  m[n - 1] = n > 2 ? (3 * d[n - 2] - m[n - 2]) / 2 : d[n - 2];
  if (sign(m[0]) !== sign(d[0])) m[0] = 0;
  else if (Math.abs(m[0]) > 3 * Math.abs(d[0])) m[0] = 3 * d[0];
  if (sign(m[n - 1]) !== sign(d[n - 2])) m[n - 1] = 0;
  else if (Math.abs(m[n - 1]) > 3 * Math.abs(d[n - 2])) m[n - 1] = 3 * d[n - 2];
  return m;
}

export function monotonePath(points: Pt[]): string {
  const n = points.length;
  if (n === 0) return '';
  const r = (v: number) => Math.round(v * 100) / 100;
  if (n === 1) return `M ${r(points[0][0])} ${r(points[0][1])}`;
  const m = slopes(points);
  let d = `M ${r(points[0][0])} ${r(points[0][1])}`;
  for (let i = 0; i < n - 1; i++) {
    const [x0, y0] = points[i];
    const [x1, y1] = points[i + 1];
    const dx = (x1 - x0) / 3;
    d += ` C ${r(x0 + dx)} ${r(y0 + m[i] * dx)} ${r(x1 - dx)} ${r(y1 - m[i + 1] * dx)} ${r(x1)} ${r(y1)}`;
  }
  return d;
}
