import { View } from 'react-native';

import { Card } from '@/shared/components/ui/card';
import { Text } from '@/shared/components/ui/text';
import { useTexts } from '@/shared/i18n';
import { cn } from '@/shared/lib/utils';

import { BigButton } from './big-button';
import { havenTexts } from './i18n';

type InlineConfirmProps = {
  /** The question, in a short sentence ("End the emergency?"). */
  title: string;
  /** What happens if you confirm ("The packet will be sent to Earth."). */
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  /** Use `destructive` only when confirming opens/escalates an emergency. Default primary. */
  confirmVariant?: 'primary' | 'destructive';
  className?: string;
};

/**
 * In-line confirmation (DESIGN_SYSTEM.md §3, "no pop-ups"): replaces the action in place with a
 * question, its consequence and two stacked 56 pt buttons (confirm on top, cancel as secondary).
 * Replaces RNR `Alert` for confirmations. No animation.
 */
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
