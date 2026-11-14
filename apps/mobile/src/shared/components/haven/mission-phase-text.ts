import type { Mission } from '@haven/core';
import { useLanguage, useTexts } from '@/shared/i18n';
import { havenTexts } from './i18n';
import { missionPhase, missionPhaseText } from './logic/mission-phase';

export function useMissionPhaseText(): (
  mission: Pick<Mission, 'status' | 'day' | 'start'>,
) => string {
  const t = useTexts(havenTexts);
  const language = useLanguage();
  const texts = {
    day: t.day,
    preparing: t.phasePreparing,
    startsOn: t.phaseStartsOn,
    finishedDay: t.phaseFinishedDay,
  };
  const date = (iso: string) =>
    new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString(language, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    });
  return (mission) => missionPhaseText(missionPhase(mission), texts, date);
}
