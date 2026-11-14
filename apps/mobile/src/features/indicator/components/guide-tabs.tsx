import type { Indicator } from '@haven/core';
import { openBrowserAsync } from 'expo-web-browser';
import { ExternalLink } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent } from '@/shared/components/ui/card';
import { Icon } from '@/shared/components/ui/icon';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import { Text } from '@/shared/components/ui/text';
import { useTexts, useTranslate } from '@/shared/i18n';
import { texts } from '../i18n';
import { parseSource } from '../logic/sources';

export type GuideTab = 'whatToDo' | 'howToMeasure' | 'whyItMatters';
const TABS: readonly GuideTab[] = ['whatToDo', 'howToMeasure', 'whyItMatters'];

type Props = {
  indicator: Indicator;
  tab: GuideTab;
  onTabChange: (tab: GuideTab) => void;
  /** Shown first in «What to do»: the engine explanation, the steps and «Why this level?». */
  whatToDoTop?: ReactNode;
  /** Shown at the end of «How to measure»: where the data comes from. */
  howToMeasureBottom?: ReactNode;
};

/**
 * Three tabs (DESIGN_SYSTEM §8.6): What to do · How to measure · Why it matters, from
 * `indicator.guide` (P02) with its sources at the end of each tab.
 */
export function GuideTabs({ indicator, tab, onTabChange, whatToDoTop, howToMeasureBottom }: Props) {
  const t = useTexts(texts);
  const tr = useTranslate();
  const label: Record<GuideTab, string> = {
    whatToDo: t.guideWhatToDo,
    howToMeasure: t.howToMeasure,
    whyItMatters: t.whyItMatters,
  };
  const { guide } = indicator;

  return (
    <Tabs value={tab} onValueChange={(v) => onTabChange(v as GuideTab)} className="gap-3">
      <TabsList className="min-h-touch h-auto w-full">
        {TABS.map((id) => (
          <TabsTrigger key={id} value={id} className="min-h-touch flex-1 px-1">
            <Text numberOfLines={2} className="text-center">
              {label[id]}
            </Text>
          </TabsTrigger>
        ))}
      </TabsList>
      {TABS.map((id) => (
        <TabsContent key={id} value={id}>
          <Card className="gap-0 rounded-lg py-0 shadow-none">
            <CardContent className="gap-4 p-4">
              {id === 'whatToDo' ? whatToDoTop : null}
              <Text className="text-body">{tr(guide[id]) || t.guideEmpty}</Text>
              {id === 'howToMeasure' ? howToMeasureBottom : null}
              {guide.sources.length > 0 ? (
                <View className="gap-1">
                  <Text className="text-muted-foreground text-sm font-medium">{t.sources}</Text>
                  {guide.sources.map(parseSource).map((s) =>
                    s.url ? (
                      <Button
                        key={s.url}
                        variant="link"
                        role="link"
                        accessibilityRole="link"
                        accessibilityHint={t.openSource}
                        onPress={() => void openBrowserAsync(s.url as string)}
                        className="min-h-touch h-auto justify-start gap-2 rounded-none px-0 py-0 active:opacity-70 sm:h-auto"
                      >
                        <Icon
                          as={ExternalLink}
                          size={16}
                          className="text-link group-active:opacity-100"
                        />
                        <Text className="text-link flex-1 text-sm font-normal group-active:opacity-100">
                          {s.title}
                        </Text>
                      </Button>
                    ) : (
                      <Text key={s.title} className="text-muted-foreground text-sm">
                        {s.title}
                      </Text>
                    ),
                  )}
                </View>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>
      ))}
    </Tabs>
  );
}
