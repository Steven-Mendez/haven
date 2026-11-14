import type { MissionPhase } from '@haven/core';
import { cn } from '@/lib/utils';

/**
 * Colour per kind of environment, not per level (health levels keep red / amber / green): coral for the
 * hypergravity stretches, blue for Earth orbit, violet for deep space and orbits around other bodies,
 * stone for the Moon and rust for Mars.
 */
const KIND_COLOR: Record<string, string> = {
  launch: '#d9774f',
  reentry: '#d9774f',
  station: '#3a6ff0',
  transit: '#7b5cf0',
  'lunar-orbit': '#7b5cf0',
  'mars-orbit': '#7b5cf0',
  moon: '#9a958c',
  mars: '#b8613a',
  rover: '#b8613a',
};

export const phaseColor = (environment: string) => KIND_COLOR[environment] ?? '#8a8a93';

/**
 * A mission plan as one bar: a stretch per phase, its width the share of days (with a floor so one-day
 * launch and reentry stay visible). `current` marks today's phase; `names` labels each stretch for
 * screen readers and the tooltip.
 */
export function PhaseBar({
  phases,
  names,
  current,
  className,
}: {
  phases: MissionPhase[];
  names: string[];
  current?: number;
  className?: string;
}) {
  const total = phases.reduce((n, p) => n + p.days, 0) || 1;
  return (
    <div className={cn('flex h-2 w-full gap-0.5', className)}>
      {phases.map((p, i) => (
        <span
          // biome-ignore lint/suspicious/noArrayIndexKey: phases are positional
          key={i}
          title={`${names[i] ?? p.environment} · ${p.days} d`}
          className={cn(
            'min-w-1.5 rounded-[2px] first:rounded-l-full last:rounded-r-full',
            current !== undefined && i !== current && 'opacity-35',
          )}
          style={{
            flexGrow: Math.max(p.days / total, 0.02),
            background: phaseColor(p.environment),
          }}
        />
      ))}
    </div>
  );
}
