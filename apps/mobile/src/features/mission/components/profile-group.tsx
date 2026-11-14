import type { Indicator } from '@haven/core';
import { useState } from 'react';
import { View } from 'react-native';
import { format, useUnitLabel } from '@/shared/components/haven';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Text } from '@/shared/components/ui/text';
import { config } from '@/shared/config';
import { useBaseline, usePreferences } from '@/shared/data';
import { useLanguage, useTexts, useTranslate } from '@/shared/i18n';
import { usePreflightBaseline } from '../hooks/preflight';
import { texts } from '../i18n';
import { driftPercent, isPlausible, PREFLIGHT_INDICATORS, parseMeasure } from '../logic/preflight';
import { formatNumber } from './format';
import { Group, Row } from './rows';

function PreflightRow({
  indicator,
  value,
  onChange,
}: {
  indicator: Indicator;
  value: string;
  onChange: (text: string) => void;
}) {
  const t = useTexts(texts);
  const unitText = useUnitLabel();
  const translate = useTranslate();
  const language = useLanguage();
  const id = `preflight-${indicator.id}`;
  const median = useBaseline(indicator.id)?.median;
  const typed = parseMeasure(value);
  const drift = driftPercent(typed, median);
  const implausible = typed !== undefined && !isPlausible(typed, indicator.green);
  return (
    <Row>
      <View className="flex-1 gap-0.5 pr-3">
        <Label nativeID={id} className="text-body font-medium">
          {translate(indicator.name)}
        </Label>
        <Text className="text-muted-foreground text-sm tabular-nums">
          {median !== undefined
            ? format(t.inFlight, {
                value: `${formatNumber(median, language, 1)} ${unitText(indicator.unit)}`,
              })
            : t.noInFlight}
          {drift !== undefined
            ? ` · ${format(t.drift, { sign: drift > 0 ? '+' : '', n: formatNumber(drift, language, 1) })}`
            : ''}
        </Text>
        {implausible ? <Text className="text-level-amber text-sm">{t.implausible}</Text> : null}
      </View>
      <View className="w-32 flex-row items-center gap-2">
        <Input
          aria-labelledby={id}
          value={value}
          onChangeText={onChange}
          keyboardType="decimal-pad"
          placeholder={median !== undefined ? formatNumber(median, language, 0) : '—'}
          className="min-h-touch text-body flex-1 text-right tabular-nums"
        />
        <Text className="text-muted-foreground w-10 text-sm">{unitText(indicator.unit)}</Text>
      </View>
    </Row>
  );
}

export function ProfileGroup() {
  const t = useTexts(texts);
  const language = useLanguage();
  const { crewMember } = usePreferences();
  const { baseline, save } = usePreflightBaseline(crewMember);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const indicators = PREFLIGHT_INDICATORS.map((id) =>
    config.indicators.find((i) => i.id === id),
  ).filter((i) => i !== undefined);

  const valueText = (id: string) =>
    edits[id] ??
    (baseline?.values[id] !== undefined ? formatNumber(baseline.values[id], language, 1) : '');

  return (
    <Group title={t.profileGroup} hint={t.profileHint}>
      {indicators.map((indicator) => {
        return (
          <PreflightRow
            key={indicator.id}
            indicator={indicator}
            value={valueText(indicator.id)}
            onChange={(text) => {
              setSaved(false);
              setEdits((current) => ({ ...current, [indicator.id]: text }));
            }}
          />
        );
      })}
      <Row key="save" stacked>
        <Button
          variant="outline"
          className="min-h-touch h-auto"
          disabled={Object.keys(edits).length === 0}
          onPress={async () => {
            await save(edits);
            setEdits({});
            setSaved(true);
          }}
        >
          <Text>{t.savePreflight}</Text>
        </Button>
        {saved ? (
          <Text accessibilityLiveRegion="polite" className="text-muted-foreground text-sm">
            {t.savedPreflight}
          </Text>
        ) : null}
      </Row>
    </Group>
  );
}
