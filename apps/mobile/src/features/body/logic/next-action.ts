import type { Config, I18n, Reading, Zone, ZoneProgress } from '@haven/core';
import { routineSteps } from '../../../shared/routine/steps';

export type NextAction = {
  zone: Zone;
  label: I18n;
  target: { kind: 'indicator'; id: string } | { kind: 'screen'; id: string };
};

const COGNITION: I18n = { es: 'Hacer la batería cognitiva', en: 'Do the cognitive test battery' };
const COGNITION_INDICATOR = 'reaction-time';
const WELLBEING_INDICATOR = 'mood';

export function nextDailyAction(
  readings: Reading[],
  progress: ZoneProgress[],
  config: Config,
  now: Date,
): NextAction | undefined {
  const step = routineSteps(readings, config, progress, now)[0];
  if (!step) return undefined;
  const zoneOf = (indicator: string) => {
    const id = config.indicators.find((i) => i.id === indicator)?.zone;
    return config.zones.find((z) => z.id === id);
  };
  switch (step.kind) {
    case 'cognition': {
      const zone = zoneOf(COGNITION_INDICATOR);
      return zone && { zone, label: COGNITION, target: { kind: 'screen', id: 'cognition' } };
    }
    case 'wellbeing': {
      const zone = zoneOf(WELLBEING_INDICATOR);
      return (
        zone && {
          zone,
          label: zone.dailyAction.text,
          target: { kind: 'screen', id: 'wellbeing' },
        }
      );
    }
    case 'measure': {
      const zone = zoneOf(step.indicator);
      const indicator = config.indicators.find((i) => i.id === step.indicator);
      if (!zone || !indicator) return undefined;
      return {
        zone,
        label: zone.dailyAction.opens === indicator.id ? zone.dailyAction.text : indicator.name,
        target: { kind: 'indicator', id: indicator.id },
      };
    }
    case 'check': {
      const zone = config.zones.find((z) => z.id === step.zone);
      return (
        zone && { zone, label: zone.dailyAction.text, target: { kind: 'screen', id: 'routine' } }
      );
    }
  }
}

export function latestTakenAt(readings: { takenAt: string }[]): string | undefined {
  let latest: string | undefined;
  for (const r of readings) if (!latest || r.takenAt > latest) latest = r.takenAt;
  return latest;
}
