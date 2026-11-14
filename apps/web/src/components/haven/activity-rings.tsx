import { cn } from '@/lib/utils';
import { RING_ORDER, type RingDatum, type RingId } from './rings-data';

const TOKEN: Record<RingId, 1 | 2 | 3> = { routine: 1, measurements: 2, wellbeing: 3 };

type Props = {
  /** Sectors in this order (clockwise from the top). Missing ones are simply not drawn. */
  rings: RingDatum[];
  /** Diameter in px. */
  size?: number;
  /** Accessible summary («Routine 3/7, Measurements 7/7…»). Decorative when omitted. */
  label?: string;
  /** Text in the centre (legible from ~64 px). */
  center?: string;
  /** Segments fade in one after another (360 ms each). Reduce Motion removes it (global rule). */
  animate?: boolean;
  className?: string;
};

/** Below this diameter a sector is one continuous arc (segment gaps would be sub-pixel). */
const SEGMENTED_FROM = 32;

function point(c: number, r: number, deg: number): [number, number] {
  const rad = ((deg - 90) * Math.PI) / 180;
  // Rounded: Math.cos/sin can differ in the last bits between the server and the browser (hydration).
  return [
    Math.round((c + r * Math.cos(rad)) * 100) / 100,
    Math.round((c + r * Math.sin(rad)) * 100) / 100,
  ];
}

function arc(c: number, r: number, from: number, to: number) {
  const [x0, y0] = point(c, r, from);
  const [x1, y1] = point(c, r, Math.min(to, from + 359.9));
  const large = to - from > 180 ? 1 : 0;
  return `M${x0} ${y0}A${r} ${r} 0 ${large} 1 ${x1} ${y1}`;
}

/** Gap in degrees for a gap of `px` on a circle of radius `r`. */
const gapDeg = (px: number, r: number) => (px / r) * (180 / Math.PI);

/**
 * HAVEN's mission disc: one ring split into a sector per category (routine, measurements, wellbeing), each
 * sector cut into one segment per action (4 of 7 = four lit pieces). Flat colours with butt ends, the unlit
 * segments in the same hue at low opacity. Under 32 px each sector is a single proportional arc. Shows
 * progress, never health (levels do that). Same geometry on mobile and the watch.
 */
export function ActivityRings({
  rings,
  size = 120,
  label,
  center,
  animate = true,
  className,
}: Props) {
  const c = size / 2;
  const w = Math.max(2.5, Math.round(size * 0.12 * 10) / 10);
  const r = c - w / 2;
  const ordered = RING_ORDER.map((id) => rings.find((x) => x.id === id)).filter(
    (x): x is RingDatum => Boolean(x),
  );
  const span = 360 / Math.max(1, ordered.length);
  const sectorGap = ordered.length > 1 ? gapDeg(Math.max(2, size * 0.05), r) : 0;
  const segmentGap = gapDeg(Math.max(1, size * 0.018), r);
  let order = 0;

  return (
    <div
      className={cn('relative inline-grid shrink-0 place-items-center', className)}
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role={label ? 'img' : undefined}
        aria-label={label}
        aria-hidden={label ? undefined : true}
      >
        {ordered.map((ring, i) => {
          const n = TOKEN[ring.id];
          const start = i * span + sectorGap / 2;
          const end = (i + 1) * span - sectorGap / 2;
          const total = Math.max(0, ring.total);
          const done = Math.min(Math.max(0, ring.value), total);
          const lit = `var(--ring-${n})`;
          const track = `var(--ring-${n}-track)`;

          // Continuous sector: track + proportional lit arc (small sizes, or too many actions to cut).
          const step = total > 0 ? (end - start) / total : 0;
          if (size < SEGMENTED_FROM || total <= 1 || step < segmentGap * 2.5) {
            const to = total > 0 ? start + ((end - start) * done) / total : start;
            return (
              <g key={ring.id}>
                <path
                  d={arc(c, r, start, end)}
                  fill="none"
                  strokeWidth={w}
                  style={{ stroke: track }}
                />
                {to > start ? (
                  <path
                    d={arc(c, r, start, to)}
                    fill="none"
                    strokeWidth={w}
                    className={animate ? 'motion-safe:animate-ring-in' : undefined}
                    style={{ stroke: lit, animationDelay: `${order++ * 40}ms` }}
                  />
                ) : null}
              </g>
            );
          }

          return (
            <g key={ring.id}>
              {Array.from({ length: total }, (_, k) => {
                const on = k < done;
                return (
                  <path
                    // biome-ignore lint/suspicious/noArrayIndexKey: one fixed segment per action
                    key={k}
                    d={arc(
                      c,
                      r,
                      start + k * step + segmentGap / 2,
                      start + (k + 1) * step - segmentGap / 2,
                    )}
                    fill="none"
                    strokeWidth={w}
                    className={on && animate ? 'motion-safe:animate-ring-in' : undefined}
                    style={{
                      stroke: on ? lit : track,
                      animationDelay: on ? `${order++ * 40}ms` : undefined,
                    }}
                  />
                );
              })}
            </g>
          );
        })}
      </svg>
      {center ? (
        <span
          aria-hidden="true"
          className="absolute leading-none font-medium tabular-nums"
          style={{ fontSize: Math.max(10, Math.round(size * 0.18)) }}
        >
          {center}
        </span>
      ) : null}
    </div>
  );
}
