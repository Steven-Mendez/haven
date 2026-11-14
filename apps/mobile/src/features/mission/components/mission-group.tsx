import type { Mission } from '@haven/core';
import { View } from 'react-native';
import { format, missionPhase, useMissionPhaseText } from '@/shared/components/haven';
import { Text } from '@/shared/components/ui/text';
import { config } from '@/shared/config';
import { useLanguage, useTexts, useTranslate } from '@/shared/i18n';
import { texts } from '../i18n';
import type { MissionRecord } from '../logic/mission-record';
import { Group, Row } from './rows';

export function MissionGroup({
  mission,
  record,
}: {
  mission: Mission;
  record: MissionRecord | undefined;
}) {
  const t = useTexts(texts);
  const translate = useTranslate();
  const language = useLanguage();
  const environment = config.environments.find((e) => e.id === mission.environment);
  const startDate = record ? new Date(`${record.start}T00:00:00Z`) : undefined;
  const phase = missionPhase(mission);
  const phaseText = useMissionPhaseText();

  return (
    <Group title={t.missionGroup} hint={t.qrHint}>
      <Row stacked>
        <View className="gap-1">
          <Text role="heading" aria-level="2" className="text-title font-semibold">
            {record?.name ?? mission.name ?? mission.code}
          </Text>
          <Text className="text-body">
            {environment ? translate(environment.name) : mission.environment}
          </Text>
          <Text className="text-muted-foreground text-sm tabular-nums">
            {phase.kind === 'running' && record
              ? format(t.dayOf, { day: phase.day, total: record.durationDays })
              : phaseText(mission)}
            {phase.kind === 'running' && startDate
              ? ` · ${format(t.startedOn, {
                  date: startDate.toLocaleDateString(language, {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                    timeZone: 'UTC',
                  }),
                })}`
              : ''}
          </Text>
          <Text
            className="text-tertiary text-caption"
            accessibilityLabel={`${t.missionCode}: ${mission.code.split('').join(' ')}`}
          >
            {format(t.codeSmall, { code: mission.code })}
          </Text>
        </View>
      </Row>
    </Group>
  );
}
