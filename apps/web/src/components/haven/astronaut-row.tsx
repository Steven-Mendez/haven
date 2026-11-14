import Link from 'next/link';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { format, formatDuration, type Language, minutesBetween } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { AgeLabel } from './age-label';
import { crewMemberLevel } from './astronaut-card';
import { LevelBadge } from './level-badge';
import { LevelGlyph } from './level-glyph';
import { levelLabel, ZONE_ORDER } from './levels';
import { Portrait } from './portrait';
import { havenTexts } from './texts';
import type { CrewCard, Now } from './types';

type RowProps = {
  member: CrewCard;
  now: Now;
  lang: Language;
  role?: string;
  zoneNames?: Record<string, string>;
  href?: string;
  portrait?: string | null;
  className?: string;
};

const zonePos = (z: string) => {
  const i = (ZONE_ORDER as readonly string[]).indexOf(z);
  return i === -1 ? ZONE_ORDER.length : i;
};

export function AstronautTableHeader({ lang }: { lang: Language }) {
  const t = havenTexts[lang];
  return (
    <TableHeader>
      <TableRow className="hover:bg-transparent">
        <TableHead className="text-muted-foreground text-[13px]">{t.colAstronaut}</TableHead>
        <TableHead className="text-muted-foreground text-[13px]">{t.colStatus}</TableHead>
        <TableHead className="text-muted-foreground text-[13px]">{t.colZones}</TableHead>
        <TableHead className="text-muted-foreground text-right text-[13px]">{t.colToday}</TableHead>
        <TableHead className="text-muted-foreground text-[13px]">{t.colLastData}</TableHead>
        <TableHead className="text-muted-foreground text-right text-[13px]">
          {t.colAlerts}
        </TableHead>
      </TableRow>
    </TableHeader>
  );
}

export function AstronautRow({
  member,
  now,
  lang,
  role,
  zoneNames,
  href,
  portrait,
  className,
}: RowProps) {
  const t = havenTexts[lang];
  const stale = member.noRecentData;
  const zones = [...member.zones].sort((a, b) => zonePos(a.zone) - zonePos(b.zone));
  const staleLabel =
    stale && member.lastDataAt
      ? `${format(t.staleWarning, { t: formatDuration(minutesBetween(member.lastDataAt, now)) })} `
      : '';
  const zonesLabel = `${staleLabel}${zones
    .map((z) =>
      format(t.zoneSummary, {
        name: zoneNames?.[z.zone] ?? z.zone,
        level: levelLabel(z.level, lang),
      }),
    )
    .join(', ')}`;

  return (
    <TableRow
      data-level={crewMemberLevel(member)}
      className={cn('hover:bg-surface-elevated relative h-14', className)}
    >
      <TableCell>
        <div className="flex items-center gap-3">
          <Portrait id={member.id} name={member.name} src={portrait} size={28} />
          <div className="flex max-w-40 min-w-0 flex-col">
            {href ? (
              <Link
                href={href}
                className="focus-visible:after:ring-ring truncate font-medium after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:rounded-md focus-visible:after:ring-2"
              >
                {member.name}
              </Link>
            ) : (
              <span className="truncate font-medium">{member.name}</span>
            )}
            {role ? (
              <span title={role} className="text-muted-foreground truncate text-xs">
                {role}
              </span>
            ) : null}
          </div>
        </div>
      </TableCell>
      <TableCell>
        <LevelBadge level={crewMemberLevel(member)} lang={lang} size="sm" />
      </TableCell>
      <TableCell>
        <span className="flex items-center gap-1.5" role="img" aria-label={zonesLabel}>
          {zones.map((z) => (
            <LevelGlyph key={z.zone} level={z.level} size={10} muted={stale} />
          ))}
        </span>
      </TableCell>
      <TableCell className="numeric text-right">
        {member.dailyProgress ? (
          <>
            {member.actionsDone}
            <span className="text-muted-foreground">/{member.actionsTotal}</span>
          </>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell>
        <AgeLabel lastDataAt={member.lastDataAt} now={now} lang={lang} noRecentData={stale} />
      </TableCell>
      <TableCell className="numeric text-right">
        {member.alerts.length ? (
          member.alerts.length
        ) : (
          <span className="text-muted-foreground">0</span>
        )}
      </TableCell>
    </TableRow>
  );
}

type TableProps = {
  members: CrewCard[];
  now: Now;
  lang: Language;
  roles?: Record<string, string>;
  zoneNames?: Record<string, string>;
  hrefFor?: (id: string) => string;
  className?: string;
};

export function AstronautTable({
  members,
  now,
  lang,
  roles,
  zoneNames,
  hrefFor,
  className,
}: TableProps) {
  const sorted = [...members].sort((a, b) => a.name.localeCompare(b.name));
  return (
    <div className={cn('overflow-hidden rounded-xl border', className)}>
      <Table>
        <AstronautTableHeader lang={lang} />
        <TableBody>
          {sorted.map((m) => (
            <AstronautRow
              key={m.id}
              member={m}
              now={now}
              lang={lang}
              role={roles?.[m.id]}
              zoneNames={zoneNames}
              href={hrefFor ? hrefFor(m.id) : `/astronaut/${m.id}`}
            />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
