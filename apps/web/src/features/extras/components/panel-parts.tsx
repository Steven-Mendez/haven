import { type LucideIcon, UserRound } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

// Shared pieces of the crew panels (EVA, reentry, medication, samples), in the
// style of the Indicators table: card table, small uppercase header, icon
// tile in the first column, status pills on the scale colors and a footer.

export type Tone = 'green' | 'amber' | 'red' | 'muted';

const TONE_COLOR: Record<Exclude<Tone, 'muted'>, string> = {
  green: 'var(--scale-green)',
  amber: 'var(--scale-amber)',
  red: 'var(--scale-red)',
};

/** Maps an engine level to a pill tone; pending and no-data are muted. */
export function toneOf(level: string): Tone {
  return level === 'green' || level === 'amber' || level === 'red' ? level : 'muted';
}

/** Status as a pill: colored dot plus text, never color alone. */
export function StatusPill({
  tone,
  children,
  icon: Icon,
  className,
}: {
  tone: Tone;
  children: ReactNode;
  icon?: LucideIcon;
  className?: string;
}) {
  const color = tone === 'muted' ? undefined : TONE_COLOR[tone];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full py-0.5 pr-2.5 pl-2 text-xs whitespace-nowrap tabular-nums',
        color ? 'text-foreground' : 'bg-muted text-muted-foreground',
        className,
      )}
      style={color ? { background: `color-mix(in oklab, ${color} 14%, transparent)` } : undefined}
    >
      {Icon ? (
        <Icon aria-hidden="true" className="size-3.5" style={color ? { color } : undefined} />
      ) : (
        <span
          aria-hidden="true"
          className="size-1.5 shrink-0 rounded-full"
          style={{ background: color ?? 'var(--muted-foreground)' }}
        />
      )}
      <span className={color ? 'font-medium' : undefined}>{children}</span>
    </span>
  );
}

/** Icon tile used in the first column of the tables. */
export function IconTile({ icon: Icon = UserRound }: { icon?: LucideIcon }) {
  return (
    <span
      aria-hidden="true"
      className="bg-surface-elevated text-muted-foreground group-hover/row:text-brand flex size-8 shrink-0 items-center justify-center rounded-lg border transition-colors"
    >
      <Icon className="size-4" />
    </span>
  );
}

/** First cell: icon tile, the crew member's name linking to their page and a detail line. */
export function CrewCell({ id, name, detail }: { id: string; name: string; detail?: ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <IconTile />
      <div className="flex min-w-0 flex-col gap-0.5">
        <Link href={`/astronaut/${id}`} className="font-medium hover:underline">
          {name}
        </Link>
        {detail ? <span className="text-tertiary text-2xs">{detail}</span> : null}
      </div>
    </div>
  );
}

/** Classes of the table card, its header row and its footer. */
export const panelTable = {
  card: 'bg-card overflow-hidden rounded-xl border shadow-xs',
  header: 'bg-surface/60',
  headRow: '[&>th]:text-2xs [&>th]:h-9 [&>th]:tracking-wider [&>th]:uppercase',
  row: 'group/row align-top hover:shadow-[inset_2px_0_0_var(--brand)]',
  footer:
    'bg-surface/40 text-tertiary flex flex-wrap items-center justify-between gap-3 border-t px-4 py-2 text-xs',
};

/** Section title with a count and a description, as in the Indicators page. */
export function PanelHeading({
  id,
  title,
  count,
  description,
  children,
}: {
  id: string;
  title: ReactNode;
  count?: number;
  description?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="flex flex-col gap-0.5">
        <h2 id={id} className="text-sm font-semibold">
          {title}
          {count !== undefined ? (
            <span className="text-tertiary ml-2 font-normal tabular-nums">{count}</span>
          ) : null}
        </h2>
        {description ? <p className="text-muted-foreground text-xs">{description}</p> : null}
      </div>
      {children}
    </div>
  );
}

/** Summary chips: one per state with its count, as a legend above the table. */
export function SummaryChips({
  items,
  label,
}: {
  items: { key: string; tone: Tone; label: string; count: number }[];
  label: string;
}) {
  return (
    <ul aria-label={label} className="flex flex-wrap items-center gap-2">
      {items.map((i) => (
        <li key={i.key}>
          <StatusPill tone={i.tone}>
            {i.label}
            <span className="text-muted-foreground ml-1 font-normal">{i.count}</span>
          </StatusPill>
        </li>
      ))}
    </ul>
  );
}
