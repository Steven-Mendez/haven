import { loadConfig, phaseAt } from '@haven/core';
import Link from 'next/link';
import { EmptyState, TimeAgo } from '@/components/haven';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { format, formatDate, type Language, translate } from '@/lib/i18n';
import { openMission } from '../actions';
import type { ExtrasTexts } from '../i18n';
import { agoText } from '../logic/time';
import { listMissions } from '../server';
import { MergeMission } from './merge-mission';
import { MissionsWorkspace } from './missions-workspace';

export async function MissionsPanel({
  current,
  lang,
  t,
}: {
  current: string;
  lang: Language;
  t: ExtrasTexts;
}) {
  const { missions } = await listMissions();
  const now = new Date();
  const config = loadConfig();
  const envName = (id: string) => {
    const e = config.environments.find((x) => x.id === id);
    return e ? translate(e.name, lang) : id;
  }; /** Today's stretch of a phased mission («Cruise to Mars»), else its environment. */
  const stageName = (m: (typeof missions)[number]) => {
    const phase = m.phases?.length ? phaseAt(m.phases, m.day)?.phase : undefined;
    return phase?.label ? translate(phase.label, lang) : envName(m.environment);
  };

  // Missions that only exist because packets arrived with an unknown code: flagged, and merged into a real one.
  const unknown = (m: (typeof missions)[number]) => m.origin === 'packet';
  const targets = missions.filter((m) => !unknown(m)).map((m) => ({ code: m.code, name: m.name }));
  const dayText = (m: (typeof missions)[number]) =>
    unknown(m)
      ? '—'
      : m.status === 'planned'
        ? t.notStarted
        : m.status === 'scheduled'
          ? format(t.startsOn, { date: formatDate(m.start, lang) })
          : format(t.dayOf, { day: m.day, total: m.durationDays });
  /** Row action: «Current», «Merge…» for an unknown code, otherwise «Open». */
  const rowAction = (m: (typeof missions)[number], mobile: boolean) =>
    m.code === current ? (
      <Badge variant="secondary">{t.current}</Badge>
    ) : (
      <div className="flex items-center justify-end gap-1">
        {unknown(m) ? <MergeMission from={m.code} targets={targets} lang={lang} /> : null}
        <form action={openMission.bind(null, m.code)}>
          <Button
            type="submit"
            variant="ghost"
            size="sm"
            className={mobile ? 'hit-area' : undefined}
            aria-label={mobile ? `${t.open} ${m.name}` : undefined}
          >
            {t.open}
          </Button>
        </form>
      </div>
    );
  /** Name cell: links to the mission page; an unknown code says so instead of passing for a real mission. */
  const nameOf = (m: (typeof missions)[number]) =>
    unknown(m) ? (
      <Badge variant="outline" title={t.unknownCodeHint}>
        {t.unknownCode}
      </Badge>
    ) : (
      <Link href={`/missions/${m.code}`} className="hover:underline">
        {m.name}
      </Link>
    );
  /** Preparation / Running / Finished. */
  const statusOf = (m: (typeof missions)[number]) =>
    m.status === 'planned' || m.status === 'scheduled'
      ? t.statusPreparation
      : m.status === 'finished'
        ? t.statusFinished
        : t.statusRunning;

  const table = (
    <div>
      {missions.length === 0 ? (
        <EmptyState title={t.noMissions} />
      ) : (
        <>
          <ul
            className="divide-border-subtle divide-y overflow-hidden rounded-xl border md:hidden"
            data-testid="missions-list"
            aria-label={t.missionsPageTitle}
          >
            {missions.map((m) => {
              const detail = unknown(m) ? t.unknownCode : `${stageName(m)} · ${dayText(m)}`;
              return (
                <li
                  key={m.code}
                  data-code={m.code}
                  className="flex min-h-11 items-center gap-3 px-4 py-1 text-sm"
                >
                  <span className="min-w-0 flex-1 truncate" title={`${m.name} · ${detail}`}>
                    {unknown(m) ? null : (
                      <>
                        <Link href={`/missions/${m.code}`} className="font-medium hover:underline">
                          {m.name}
                        </Link>
                        <span className="text-muted-foreground"> · {statusOf(m)} · </span>
                      </>
                    )}
                    <span className="text-muted-foreground">{detail}</span>
                  </span>
                  {rowAction(m, true)}
                </li>
              );
            })}
          </ul>
          <div className="hidden overflow-hidden rounded-xl border md:block">
            <Table data-testid="missions-table">
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">{t.missionName}</TableHead>
                  <TableHead>{t.missionStatus}</TableHead>
                  <TableHead>{t.currentStage}</TableHead>
                  <TableHead>{t.day}</TableHead>
                  <TableHead className="text-right">{t.crew}</TableHead>
                  <TableHead>{t.created}</TableHead>
                  <TableHead className="pr-4">
                    <span className="sr-only">{t.open}</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {missions.map((m) => (
                  <TableRow key={m.code} data-code={m.code}>
                    <TableCell className="pl-4 font-medium">{nameOf(m)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {unknown(m) ? '—' : statusOf(m)}
                    </TableCell>
                    <TableCell>{unknown(m) ? '—' : stageName(m)}</TableCell>
                    <TableCell className="numeric">{dayText(m)}</TableCell>
                    <TableCell className="numeric text-right">{m.crew.length}</TableCell>
                    <TableCell className="text-muted-foreground">
                      <TimeAgo at={m.createdAt} lang={lang}>
                        {agoText(m.createdAt, now, t)}
                      </TimeAgo>
                    </TableCell>
                    <TableCell className="pr-4 text-right">{rowAction(m, false)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
  return <MissionsWorkspace lang={lang} table={table} />;
}
