import { cn } from '@/lib/utils';
import type { SeriesPoint, VisualLevel } from './types';

const toMs = (v: string | number) => (typeof v === 'number' ? v : Date.parse(v));

function normalise(points: SeriesPoint[]) {
  return points
    .map(([at, value]) => ({ at: toMs(at), value }))
    .filter((d) => Number.isFinite(d.at) && Number.isFinite(d.value))
    .sort((a, b) => a.at - b.at);
}

/** Monotone cubic path (Fritsch–Carlson), the same curve recharts draws with `type="monotone"`. */
function monotonePath(xy: [number, number][]): string {
  const n = xy.length;
  if (n < 2) return '';
  const dx: number[] = [];
  const m: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    const [x0, y0] = xy[i] as [number, number];
    const [x1, y1] = xy[i + 1] as [number, number];
    dx.push(x1 - x0);
    m.push((y1 - y0) / (x1 - x0 || 1));
  }
  const tan: number[] = [m[0] ?? 0];
  for (let i = 1; i < n - 1; i++) {
    const s0 = m[i - 1] ?? 0;
    const s1 = m[i] ?? 0;
    const h0 = dx[i - 1] ?? 0;
    const h1 = dx[i] ?? 0;
    const p = (s0 * h1 + s1 * h0) / (h0 + h1 || 1);
    tan.push(
      (Math.sign(s0) + Math.sign(s1)) * Math.min(Math.abs(s0), Math.abs(s1), 0.5 * Math.abs(p)) ||
        0,
    );
  }
  tan.push(m[n - 2] ?? 0);
  let d = `M${xy[0]?.[0].toFixed(2)} ${xy[0]?.[1].toFixed(2)}`;
  for (let i = 0; i < n - 1; i++) {
    const [x0, y0] = xy[i] as [number, number];
    const [x1, y1] = xy[i + 1] as [number, number];
    const h = (dx[i] ?? 0) / 3;
    d += ` C${(x0 + h).toFixed(2)} ${(y0 + h * (tan[i] ?? 0)).toFixed(2)} ${(x1 - h).toFixed(2)} ${(y1 - h * (tan[i + 1] ?? 0)).toFixed(2)} ${x1.toFixed(2)} ${y1.toFixed(2)}`;
  }
  return d;
}

const isFlagged = (level?: VisualLevel) => level === 'red' || level === 'amber';
const levelVar = (level?: VisualLevel) =>
  level === 'red' ? 'var(--level-red)' : 'var(--level-amber)';

/**
 * Table sparkline (chart spec): 60 × 16, 1.25 px line in the secondary colour with a Ø2 end dot. It takes the
 * level colour only when the indicator is out of range (`level` red or amber). Decorative: the row text carries
 * the value.
 */
export function Sparkline({
  points,
  level,
  width = 60,
  height = 16,
  className,
}: {
  points: SeriesPoint[];
  level?: VisualLevel;
  width?: number;
  height?: number;
  className?: string;
}) {
  const data = normalise(points).slice(-30);
  if (data.length < 2) {
    return <span aria-hidden="true" className={cn('inline-block', className)} style={{ width }} />;
  }
  const lo = Math.min(...data.map((d) => d.value));
  const span = Math.max(...data.map((d) => d.value)) - lo || 1;
  const t0 = data[0]?.at ?? 0;
  const tSpan = (data.at(-1)?.at ?? 1) - t0 || 1;
  const xy = data.map(
    (d) =>
      [1 + ((d.at - t0) / tSpan) * (width - 3), 2 + (1 - (d.value - lo) / span) * (height - 4)] as [
        number,
        number,
      ],
  );
  const color = isFlagged(level) ? levelVar(level) : 'var(--muted-foreground)';
  const end = xy.at(-1) as [number, number];
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
      className={cn('shrink-0 overflow-visible', className)}
    >
      <path
        d={monotonePath(xy)}
        fill="none"
        stroke={color}
        strokeWidth={1.25}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx={end[0]} cy={end[1]} r={1} fill={color} />
    </svg>
  );
}

/**
 * Tile chart (chart spec: 48 px): the same line + 8 % area as the main chart, no axes. Width follows the
 * container; the end dot is an HTML element so it stays round while the SVG stretches.
 */
export function MiniTrend({
  points,
  level,
  height = 48,
  className,
}: {
  points: SeriesPoint[];
  level?: VisualLevel;
  height?: number;
  className?: string;
}) {
  const data = normalise(points).slice(-60);
  if (data.length < 2) return <div aria-hidden="true" style={{ height }} className={className} />;
  const W = 200;
  const H = height;
  const lo = Math.min(...data.map((d) => d.value));
  const span = Math.max(...data.map((d) => d.value)) - lo || 1;
  const t0 = data[0]?.at ?? 0;
  const tSpan = (data.at(-1)?.at ?? 1) - t0 || 1;
  const xy = data.map(
    (d) =>
      [((d.at - t0) / tSpan) * W, 3 + (1 - (d.value - lo) / span) * (H - 6)] as [number, number],
  );
  const line = monotonePath(xy);
  const area = `${line} L${W} ${H} L0 ${H} Z`;
  const end = xy.at(-1) as [number, number];
  const dot = isFlagged(level) ? levelVar(level) : 'var(--chart-line)';
  const gid = `mt-${Math.round(lo * 1000)}-${data.length}-${Math.round(span * 1000)}`;
  return (
    <div aria-hidden="true" className={cn('relative w-full', className)} style={{ height }}>
      <svg
        aria-hidden="true"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="absolute inset-0 size-full overflow-visible"
      >
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--chart-line)" stopOpacity={0.08} />
            <stop offset="100%" stopColor="var(--chart-line)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <path d={area} fill={`url(#${gid})`} />
        <path
          d={line}
          fill="none"
          stroke="var(--chart-line)"
          strokeWidth={1.5}
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <span
        className="absolute size-1 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          left: `${(end[0] / W) * 100}%`,
          top: `${(end[1] / H) * 100}%`,
          background: dot,
          boxShadow: `0 0 0 3px color-mix(in srgb, ${dot} 15%, transparent)`,
        }}
      />
    </div>
  );
}
