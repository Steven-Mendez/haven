import { router } from 'expo-router';
import { useMissionPhaseText } from '@/shared/components/haven';
import { MissionStrip } from '@/shared/components/haven/mission-strip';
import { config } from '@/shared/config';
import { useMission, usePendingSends } from '@/shared/data';
import { useTranslate } from '@/shared/i18n';

type Props = { className?: string };

/**
 * Mission header (M00, contract B): the designer's `MissionStrip` (DESIGN_SYSTEM.md §3.7) fed from
 * `@/shared/data`. The delay chip shows the environment's communication delay as mission data
 * (nothing is delayed artificially); the link chip opens Mission on its Link group
 * (`/mission?focus=link`) and the queue chip opens the queue.
 *
 * No developer shortcut here: in development builds `/dev` opens from the Expo dev menu (shake /
 * ⌘D → «HAVEN developer panel») or with the deep link `haven://dev` (see `@/shared/startup`).
 */
export function MissionHeader({ className }: Props) {
  const translate = useTranslate();
  const mission = useMission();
  const queued = usePendingSends();
  const environment = config.environments.find((e) => e.id === mission.environment);
  const name = environment ? translate(environment.name) : mission.environment;
  const phaseText = useMissionPhaseText();

  return (
    <MissionStrip
      code={mission.code}
      name={mission.name}
      day={mission.day}
      dayLabel={phaseText(mission)}
      environment={name}
      delayMin={mission.currentDelayMin}
      linkDown={mission.linkDown}
      queued={queued}
      onPressQueue={() => router.push('/queue')}
      onPressLink={() => router.push({ pathname: '/mission', params: { focus: 'link' } })}
      className={className}
    />
  );
}
