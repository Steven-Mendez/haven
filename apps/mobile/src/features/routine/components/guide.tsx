import { View } from 'react-native';
import { DayRing, LevelBadge } from '@/shared/components/haven';
import { Badge } from '@/shared/components/ui/badge';
import { Card } from '@/shared/components/ui/card';
import { Text } from '@/shared/components/ui/text';
import { useTexts } from '@/shared/i18n';
import { texts } from '../i18n';
import { GUIDE_EXAMPLES, type GuideExample } from '../logic/routine';

const CAPTION: Record<GuideExample['key'], keyof (typeof texts)['es']> = {
  notStarted: 'guideNotStarted',
  inProgress: 'guideInProgress',
  completeAmber: 'guideCompleteAmber',
  reopenedRed: 'guideReopenedRed',
  pendingReading: 'guidePendingReading',
  done: 'guideDone',
};

export function ActionsGuide() {
  const t = useTexts(texts);
  return (
    <View className="gap-3">
      <Text className="text-body text-muted-foreground">{t.guideIntro}</Text>
      <View className="flex-row flex-wrap gap-3">
        {GUIDE_EXAMPLES.map((example) => (
          <Card
            key={example.key}
            className="min-w-[46%] flex-1 basis-[46%] items-center gap-2 rounded-lg p-3 shadow-none"
          >
            <Badge variant="outline" className="self-start rounded-sm">
              <Text className="text-muted-foreground text-xs font-medium">{t.example}</Text>
            </Badge>
            <DayRing segments={example.segments} size={96} />
            <LevelBadge level={example.level} size="sm" />
            <Text className="text-muted-foreground text-center text-sm">
              {t[CAPTION[example.key]]}
            </Text>
          </Card>
        ))}
      </View>
    </View>
  );
}
