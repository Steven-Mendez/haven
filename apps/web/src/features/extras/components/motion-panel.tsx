import { type Level, loadConfig, motion, motionLevel } from '@haven/core';
import { Info } from 'lucide-react';
import { AgeLabel, EmptyState, Hint } from '@/components/haven';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { format, type Language } from '@/lib/i18n';
import type { ExtrasTexts } from '../i18n';
import type { MotionRow } from '../logic/motion';
import { getMotionOverview } from '../server';
import { CrewTable } from './crew-table';
import { CrewCell, crewHref, crewTableTexts, StatusPill, type Tone, toneOf } from './panel-parts';

const { environments } = loadConfig();

const LEVELS: { level: Level; label: (t: ExtrasTexts) => string }[] = [
  { level: 'green', label: (t) => t.moNone },
  { level: 'amber', label: (t) => t.moSick },
  { level: 'red', label: (t) => t.moNausea },
  { level: 'pending', label: (t) => t.moNoData },
];

const SCALE_COLOR: Record<string, string> = {
  green: 'var(--scale-green)',
  amber: 'var(--scale-amber)',
  red: 'var(--scale-red)',
};

const levelOf = (row: MotionRow): Level => row.latest?.level ?? 'pending';

const balanceLabel = (level: Level, t: ExtrasTexts) =>
  level === 'red' ? t.moBalanceRed : level === 'amber' ? t.moBalanceAmber : t.moBalanceGreen;

function adviceText(row: MotionRow, t: ExtrasTexts) {
  const parts = [
    row.latest?.level === 'red'
      ? t.moAdviceRed
      : row.latest?.level === 'amber'
        ? t.moAdviceAmber
        : '',
    row.surface && row.balance && row.balance.level !== 'green' ? t.moAdviceBalance : '',
  ].filter(Boolean);
  return parts.length ? parts.join(' ') : t.moAdviceGreen;
}

/** The last 7 days as one strip: each day shows its worst score on its scale color. */
function DayStrip({ row, lang, t }: { row: MotionRow; lang: Language; t: ExtrasTexts }) {
  return (
    <ul className="bg-surface-elevated/60 inline-flex items-center divide-x rounded-md border">
      {row.days.map((d) => {
        const day = new Date(`${d.day}T12:00:00Z`).toLocaleDateString(lang, {
          weekday: 'short',
          day: 'numeric',
          timeZone: 'UTC',
        });
        const label =
          d.score === null
            ? format(t.moDayNone, { day })
            : format(t.moDayScore, { day, score: d.score });
        const color = d.score === null ? undefined : SCALE_COLOR[motionLevel(d.score, motion)];
        return (
          <li key={d.day}>
            <Hint label={label} side="top">
              <span
                className="text-2xs flex size-7 items-center justify-center font-medium tabular-nums"
                style={
                  color
                    ? { background: `color-mix(in oklab, ${color} 22%, transparent)` }
                    : undefined
                }
              >
                <span aria-hidden="true" className={d.score === null ? 'text-tertiary' : undefined}>
                  {d.score ?? '·'}
                </span>
                <span className="sr-only">{label}</span>
              </span>
            </Hint>
          </li>
        );
      })}
    </ul>
  );
}

function WindowCell({ row, lang, t }: { row: MotionRow; lang: Language; t: ExtrasTexts }) {
  const w = row.window;
  return (
    <span className="flex flex-col items-start gap-1">
      {w.open ? (
        <StatusPill tone="amber">
          {w.reason === 'launch'
            ? format(t.moWindowLaunch, { day: w.day, of: w.of })
            : format(t.moWindowTransition, {
                day: w.day,
                of: w.of,
                environment:
                  environments.find((e) => e.id === w.environment)?.name[lang] ?? w.environment,
              })}
        </StatusPill>
      ) : (
        <StatusPill tone="muted">{t.moWindowClosed}</StatusPill>
      )}
      {row.checkDue ? <span className="text-muted-foreground">{t.moCheckDue}</span> : null}
    </span>
  );
}

function BalanceCell({ row, t }: { row: MotionRow; t: ExtrasTexts }) {
  if (!row.surface) return <span className="text-tertiary">{t.moNoGravity}</span>;
  if (!row.balance) return <span className="text-tertiary">{t.moBalanceNone}</span>;
  const tone: Tone = toneOf(row.balance.level);
  return (
    <span className="flex flex-col items-start gap-1">
      <StatusPill tone={tone}>{balanceLabel(row.balance.level, t)}</StatusPill>
      <span className="text-muted-foreground tabular-nums">
        {format(t.moBalanceDetail, { closed: row.balance.closed, ratio: row.balance.ratio })}
      </span>
    </span>
  );
}

export async function MotionPanel({
  mission,
  lang,
  t,
}: {
  mission: string;
  lang: Language;
  t: ExtrasTexts;
}) {
  const data = await getMotionOverview(mission);
  const rows = data?.rows ?? [];
  const sick = rows.filter((r) => r.latest && r.latest.level !== 'green').length;

  return (
    <div className="flex min-w-0 flex-col gap-3">
      {rows.length === 0 || !data ? (
        <EmptyState title={t.motionEmpty} description={t.motionEmptyDetail} />
      ) : (
        <CrewTable
          id="motion"
          testId="motion-table"
          title={t.motionTitle}
          description={t.motionDescription}
          groups={LEVELS.map((l) => ({ key: l.level, tone: toneOf(l.level), label: l.label(t) }))}
          columns={[
            { label: t.astronaut },
            { label: t.moScoreCol, className: 'whitespace-normal' },
            { label: t.moDaysCol, className: 'hidden xl:table-cell' },
            { label: t.moWindowCol },
            { label: t.moBalanceCol },
            {
              label: t.moAdviceCol,
              className: 'text-muted-foreground hidden min-w-52 whitespace-normal 2xl:table-cell',
            },
          ]}
          rows={rows.map((row) => ({
            id: row.id,
            name: row.name,
            group: levelOf(row),
            href: crewHref(row.id),
            cells: [
              <CrewCell
                key="crew"
                id={row.id}
                name={row.name}
                detail={
                  <AgeLabel
                    lastDataAt={row.lastDataAt}
                    now={data.generatedAt}
                    lang={lang}
                    noRecentData={row.noRecentData}
                  />
                }
              />,
              row.latest ? (
                <StatusPill key="score" tone={toneOf(row.latest.level)}>
                  {format(t.moScore, { score: row.latest.score })} ·{' '}
                  {LEVELS.find((l) => l.level === row.latest?.level)?.label(t)}
                </StatusPill>
              ) : (
                <span key="score" className="text-tertiary">
                  {t.moNoRecent}
                </span>
              ),
              <DayStrip key="days" row={row} lang={lang} t={t} />,
              <WindowCell key="window" row={row} lang={lang} t={t} />,
              <BalanceCell key="balance" row={row} t={t} />,
              adviceText(row, t),
            ],
          }))}
          summary={format(t.motionFooter, { n: sick, total: rows.length })}
          texts={crewTableTexts(t)}
        />
      )}
      <Collapsible>
        <CollapsibleTrigger className="text-muted-foreground hover:text-foreground hit-area flex min-h-8 items-center gap-1.5 text-xs">
          <Info aria-hidden="true" className="size-3.5" />
          {t.howCalculated}
        </CollapsibleTrigger>
        <CollapsibleContent className="text-muted-foreground max-w-3xl pt-1 text-xs">
          {t.motionHowTo} {motion.source}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
