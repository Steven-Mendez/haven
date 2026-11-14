import { Construction } from 'lucide-react-native';
import { EmptyState } from '@/shared/components/haven/empty-state';
import { ReadingSource } from '@/shared/components/reading-source';
import { Screen } from '@/shared/components/screen';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Text } from '@/shared/components/ui/text';
import { useReadings } from '@/shared/data';
import { useTexts } from '@/shared/i18n';
import { commonTexts } from '@/shared/i18n/common';

type Props = { id: string; title: string; description?: string };

export function PendingScreen({ id, title, description }: Props) {
  const t = useTexts(commonTexts);
  const readings = useReadings();
  const latest = readings[readings.length - 1];
  return (
    <Screen contentClassName="gap-4">
      <EmptyState icon={Construction} title={`${id} · ${title}`} description={description} />
      {latest ? (
        <Card>
          <CardHeader>
            <CardTitle>{t.latestReading}</CardTitle>
          </CardHeader>
          <CardContent className="gap-1">
            <Text className="font-mono">
              {latest.indicator}: {String(latest.value)} {latest.unit}
            </Text>
            <ReadingSource reading={latest} />
          </CardContent>
        </Card>
      ) : null}
    </Screen>
  );
}
