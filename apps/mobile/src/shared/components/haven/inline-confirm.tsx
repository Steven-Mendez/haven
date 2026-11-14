import { View } from 'react-native';

import { Card } from '@/shared/components/ui/card';
import { Text } from '@/shared/components/ui/text';
import { useTexts } from '@/shared/i18n';
import { cn } from '@/shared/lib/utils';

import { BigButton } from './big-button';
import { havenTexts } from './i18n';

type InlineConfirmProps = {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmVariant?: 'primary' | 'destructive';
  className?: string;
};

export function InlineConfirm({
  title,
  description,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  confirmVariant = 'primary',
  className,
}: InlineConfirmProps) {
  const t = useTexts(havenTexts);
  return (
    <Card
      accessibilityLiveRegion="polite"
      className={cn(
        'border-border-strong gap-4 rounded-lg border bg-transparent px-4 py-4',
        className,
      )}
    >
      <View className="gap-1">
        <Text role="heading" className="text-title-sm font-semibold">
          {title}
        </Text>
        {description ? (
          <Text className="text-muted-foreground text-footnote">{description}</Text>
        ) : null}
      </View>
      <View className="gap-2">
        <BigButton label={confirmLabel ?? t.confirm} onPress={onConfirm} variant={confirmVariant} />
        <BigButton label={cancelLabel ?? t.cancel} onPress={onCancel} variant="secondary" />
      </View>
    </Card>
  );
}
