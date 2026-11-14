import { View } from 'react-native';
import { format } from '@/shared/components/haven';
import { Button } from '@/shared/components/ui/button';
import { Text } from '@/shared/components/ui/text';
import { useAgeMin } from '@/shared/data';
import { useLanguage, useTexts } from '@/shared/i18n';
import type { useEarthRules } from '../hooks/rules';
import { type MissionTexts, texts } from '../i18n';
import type { ReceivedRules, RulesAuditEvent } from '../logic/rules';
import { Group, Row } from './rows';

function eventLabel(t: MissionTexts, event: RulesAuditEvent): string {
  const labels: Record<RulesAuditEvent, string> = {
    received: t.auditReceived,
    confirmed: t.auditConfirmed,
    'confirm-failed': t.auditFailed,
    activated: t.auditActivated,
  };
  return labels[event];
}

function AuditRow({ record }: { record: ReceivedRules }) {
  const t = useTexts(texts);
  const language = useLanguage();
  const time = (iso: string) =>
    new Date(iso).toLocaleString(language, {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  return (
    <Row stacked>
      <View className="gap-0.5">
        <Text className="text-body font-medium">
          {format(t.rulesVersion, { version: record.version })}
          {record.author ? ` · ${record.author}` : ''}
        </Text>
        {record.note ? <Text className="text-muted-foreground text-sm">{record.note}</Text> : null}
      </View>
      <View className="gap-0.5">
        {record.audit.map((entry) => (
          <Text
            key={`${entry.at}${entry.event}`}
            className="text-muted-foreground text-sm tabular-nums"
          >
            {time(entry.at)} · {eventLabel(t, entry.event)}
          </Text>
        ))}
      </View>
    </Row>
  );
}

/** Rules received from Earth (T03): latest version, its state and the audit history. */
export function RulesGroup({ rules }: { rules: ReturnType<typeof useEarthRules> }) {
  const t = useTexts(texts);
  const { records, latest, check, checking, lastCheck } = rules;
  const ageMin = useAgeMin(latest?.receivedAt);
  const history = [...records].sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));

  const state = latest
    ? latest.status === 'applied'
      ? t.rulesApplied
      : t.rulesPendingConfirm
    : undefined;

  return (
    <Group title={t.rulesGroup} hint={t.rulesHint}>
      <Row key="latest" stacked>
        {latest ? (
          <View className="gap-1">
            <Text className="text-body font-medium" accessibilityLiveRegion="polite">
              {format(t.rulesReceived, {
                version: latest.version,
                age: ageMin === undefined ? '—' : String(ageMin),
              })}{' '}
              · {state}
            </Text>
            <Text className="text-muted-foreground text-sm">
              {latest.activeLocally ? t.rulesActive : t.rulesNotActive}
            </Text>
          </View>
        ) : (
          <Text className="text-muted-foreground text-body">{t.rulesNone}</Text>
        )}
        <View className="flex-row items-center gap-3">
          <Button
            variant="outline"
            className="min-h-touch h-auto"
            disabled={checking}
            onPress={() => void check()}
          >
            <Text>{checking ? t.rulesChecking : t.rulesCheck}</Text>
          </Button>
          {lastCheck && lastCheck !== 'ok' ? (
            <Text className="text-muted-foreground flex-1 text-sm">
              {lastCheck === 'skipped' ? t.rulesSkipped : t.rulesOffline}
            </Text>
          ) : null}
        </View>
      </Row>
      {history.map((record) => (
        <AuditRow key={record.id} record={record} />
      ))}
    </Group>
  );
}
