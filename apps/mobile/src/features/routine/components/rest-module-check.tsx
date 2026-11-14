import type { Assessment } from '@haven/core';
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { EmptyState, formatMetric, IndicatorCard } from '@/shared/components/haven';
import { Text } from '@/shared/components/ui/text';
import { config } from '@/shared/config';
import { store } from '@/shared/data';
import { useLanguage, useTexts, useTranslate } from '@/shared/i18n';
import { texts } from '../i18n';

type Props = {
  atmosphere: Assessment[];
  children: ReactNode;
};

export function RestModuleCheck({ atmosphere, children }: Props) {
  const t = useTexts(texts);
  const translate = useTranslate();
  const language = useLanguage();
  return (
    <View className="border-border gap-3 border-l-2 pl-3">
      <Text className="text-body font-semibold">{t.restModule}</Text>
      <Text className="text-body text-muted-foreground">{t.restModuleHint}</Text>
      {atmosphere.length === 0 ? (
        <EmptyState title={t.noCabin} />
      ) : (
        atmosphere.map((a) => {
          const indicator = config.indicators.find((i) => i.id === a.indicator);
          return (
            <IndicatorCard
              key={a.indicator}
              name={translate(indicator?.name)}
              value={a.value}
              unit={indicator?.unit}
              level={a.level}
              explanation={translate(a.explanation)}
              source={store.latestReading(a.indicator)?.source}
              ageMin={a.ageMin >= 0 ? a.ageMin : undefined}
              formatValue={(v) => formatMetric(v, language)}
            />
          );
        })
      )}
      {children}
    </View>
  );
}
