import type { Packet } from '@haven/core';
import { cn } from '@/lib/utils';

type Props = {
  /** `Packet.ecg`: sampling rate and voltages. */
  ecg: NonNullable<Packet['ecg']>;
  /** Accessible name («ECG attached»). */
  label: string;
  /** Scale caption under the strip («25 mm/s · large box 0.2 s»); omitted when empty. */
  scale?: string;
  /** How many seconds of the trace to draw (default 6). */
  seconds?: number;
  /** @deprecated The height follows the paper scale (1 large box = 0.2 s, square boxes). */
  height?: number;
  className?: string;
};

// Paper scale: 125 units per second → large box (0.2 s) = 25 units, small box (0.04 s) = 5 units.
const PER_SECOND = 125;
const MAJOR = 25;
const MINOR = 5;
const ROWS = 4; // 4 large boxes tall

/**
 * ECG strip (chart spec): a 1.25 px trace in the foreground over an ultra-subtle monitor grid (small boxes
 * `ecg-minor`, large boxes `ecg-major`), square boxes at 25 mm/s, no labels except the scale caption. The SVG
 * scales uniformly so the grid stays square and the time scale stays true.
 */
export function EcgStrip({ ecg, label, scale, seconds = 6, className }: Props) {
  const samples = ecg.microvolts.slice(0, Math.max(2, Math.round(ecg.hz * seconds)));
  if (samples.length < 2) return null;
  const secs = samples.length / ecg.hz;
  const w = Math.round(secs * PER_SECOND);
  const h = MAJOR * ROWS;
  const min = Math.min(...samples);
  const span = Math.max(...samples) - min || 1;
  const d = samples
    .map((v, i) => {
      const x = (i / ecg.hz) * PER_SECOND;
      const y = h - 8 - ((v - min) / span) * (h - 16);
      return `${i ? 'L' : 'M'}${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(' ');
  const id = `ecg-${samples.length}-${Math.round(min)}`;
  return (
    <figure className={cn('flex flex-col gap-1.5', className)}>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="h-auto w-full rounded-lg border"
        role="img"
        aria-label={label}
        preserveAspectRatio="xMinYMid meet"
      >
        <defs>
          <pattern id={`${id}-minor`} width={MINOR} height={MINOR} patternUnits="userSpaceOnUse">
            <path
              d={`M${MINOR} 0V${MINOR}H0`}
              fill="none"
              stroke="var(--ecg-minor)"
              strokeWidth={0.5}
            />
          </pattern>
          <pattern id={`${id}-major`} width={MAJOR} height={MAJOR} patternUnits="userSpaceOnUse">
            <rect width={MAJOR} height={MAJOR} fill={`url(#${id}-minor)`} />
            <path
              d={`M${MAJOR} 0V${MAJOR}H0`}
              fill="none"
              stroke="var(--ecg-major)"
              strokeWidth={0.75}
            />
          </pattern>
        </defs>
        <rect width={w} height={h} fill={`url(#${id}-major)`} />
        <path
          d={d}
          fill="none"
          stroke="var(--chart-line)"
          strokeWidth={1.25}
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      {scale ? <figcaption className="text-tertiary text-2xs font-mono">{scale}</figcaption> : null}
    </figure>
  );
}
