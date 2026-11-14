import { router } from 'expo-router';
import { useMissionPhaseText } from '@/shared/components/haven';
import { MissionStrip } from '@/shared/components/haven/mission-strip';
import { config } from '@/shared/config';
import { useMission, usePendingSends } from '@/shared/data';
import { useTranslate } from '@/shared/i18n';

type Props = { className?: string };

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
