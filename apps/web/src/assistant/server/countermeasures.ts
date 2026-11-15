import 'server-only';
import { type CommsMode, comms, commsMode, type Level, linkTimes } from '@haven/core';
import { havenTexts } from '@/components/haven/texts';
import type { ExtrasTexts } from '@/features/extras/i18n';
import { type EvaRow, readinessLevel } from '@/features/extras/logic/eva';
import type { ExerciseRow } from '@/features/extras/logic/exercise';
import type { MedicationRow } from '@/features/extras/logic/medication';
import type { MotionRow } from '@/features/extras/logic/motion';
import type { ReentryRow } from '@/features/extras/logic/reentry';
import type { SampleRow } from '@/features/extras/logic/samples';
import type { WorkloadRow } from '@/features/extras/logic/workload';
import { format, formatDelay, type Language } from '@/lib/i18n';
import type { CountermeasureCardView, CountermeasureTone } from '../types';

// What the chat draws for getCountermeasures: one state per crew member, in
// the same words and colors as the countermeasure tab, and a link to it.

const tone = (level: Level | string): CountermeasureTone =>
  level === 'green' || level === 'amber' || level === 'red' ? level : 'muted';

type Row = CountermeasureCardView['rows'][number];

export function evaCard(rows: EvaRow[], t: ExtrasTexts): Row[] {
  const label = { fit: t.fit, review: t.review, unfit: t.unfit, 'no-data': t.noData };
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    tone: tone(readinessLevel(r.readiness)),
    label: label[r.readiness],
    ...(r.prep.prebreathe
      ? { detail: `${r.prep.prebreathe.minutes}/${r.prep.prebreathe.required} min` }
      : {}),
  }));
}

export function reentryCard(rows: ReentryRow[], t: ExtrasTexts): Row[] {
  const tones: Record<string, CountermeasureTone> = {
    ready: 'green',
    review: 'amber',
    unfit: 'red',
  };
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    tone: tones[r.status.readiness] ?? 'muted',
    label: t[`reentry-${r.status.readiness}`],
    detail: `${r.status.done}/${r.status.total}`,
  }));
}

export function medicationCard(rows: MedicationRow[], t: ExtrasTexts): Row[] {
  const label: Record<string, string> = {
    green: t.adherenceGood,
    amber: t.adherenceIrregular,
    red: t.adherenceLow,
  };
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    tone: tone(r.level),
    label: label[r.level] ?? t.adherencePending,
    ...(r.adherence.percent !== null ? { detail: `${r.adherence.percent} %` } : {}),
  }));
}

export function samplesCard(rows: SampleRow[], t: ExtrasTexts): Row[] {
  return rows.map((r) => {
    const overdue = r.states.some((s) => s.status === 'overdue');
    const due = r.states.some((s) => s.status === 'due');
    const collected = r.states.filter((s) => s.status === 'collected').length;
    return {
      id: r.id,
      name: r.name,
      tone: overdue ? 'red' : due ? 'amber' : 'green',
      label: overdue ? t['sample-overdue'] : due ? t['sample-due'] : t.samplesUpToDate,
      detail: `${collected}/${r.states.length}`,
    };
  });
}

export function exerciseCard(rows: ExerciseRow[], t: ExtrasTexts): Row[] {
  const label: Record<string, string> = {
    green: t.exComplianceGood,
    amber: t.exComplianceIrregular,
    red: t.exComplianceLow,
  };
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    tone: tone(r.compliance.level),
    label: label[r.compliance.level] ?? t.exCompliancePending,
    ...(r.compliance.counted
      ? {
          detail: format(t.exDaysMet, { met: r.compliance.met, target: r.compliance.target }),
        }
      : {}),
  }));
}

export function motionCard(rows: MotionRow[], t: ExtrasTexts): Row[] {
  const label: Record<string, string> = { green: t.moNone, amber: t.moSick, red: t.moNausea };
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    tone: tone(r.latest?.level ?? 'pending'),
    label: r.latest ? (label[r.latest.level] ?? t.moNoData) : t.moNoData,
    ...(r.latest ? { detail: format(t.moScore, { score: r.latest.score }) } : {}),
  }));
}

export function workloadCard(rows: WorkloadRow[], t: ExtrasTexts): Row[] {
  const label: Record<string, string> = { green: t.wlGreen, amber: t.wlAmber, red: t.wlRed };
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    tone: tone(r.status.level),
    label: label[r.status.level] ?? t.wlPending,
    ...(r.status.loggedDays ? { detail: `${r.status.weekHours} h` } : {}),
  }));
}

/** The link with the crew right now: mode, delays and when something sent now arrives. */
export function commsStatus(
  mission: { name: string; currentDelayMin: number; linkDown: boolean },
  now: Date,
) {
  const mode: CommsMode = commsMode(mission, comms);
  const times = linkTimes(now, mission.currentDelayMin);
  return {
    mode,
    linkDown: mission.linkDown,
    oneWayMin: mission.currentDelayMin,
    roundTripMin: mission.currentDelayMin * 2,
    sentNowArrivesAt: mission.linkDown ? null : times.arrivesAt,
    earliestReplyAt: mission.linkDown ? null : times.replyAt,
    crewActsAlone: mode === 'autonomous' || mode === 'offline',
    thresholds: { liveUpToMin: comms.realtimeMaxMin, autonomousFromMin: comms.autonomousFromMin },
  };
}

export function commsCard(
  mission: { code: string; name: string },
  status: ReturnType<typeof commsStatus>,
  lang: Language,
): Row[] {
  const h = havenTexts[lang];
  const delay = { t: formatDelay(status.oneWayMin), rt: formatDelay(status.roundTripMin) };
  const label = {
    realtime: h.linkRealtime,
    delayed: format(h.linkDelayed, delay),
    autonomous: format(h.linkAutonomous, delay),
    offline: h.linkDownShort,
  }[status.mode];
  const detail = {
    realtime: h.linkRealtimeHint,
    delayed: format(h.linkDelayedHint, delay),
    autonomous: format(h.linkAutonomousHint, delay),
    offline: '',
  }[status.mode];
  return [
    {
      id: mission.code,
      name: mission.name,
      tone: status.mode === 'offline' ? 'red' : status.mode === 'autonomous' ? 'amber' : 'green',
      label,
      ...(detail ? { detail } : {}),
    },
  ];
}
