import { Button } from '@/shared/components/ui/button';
import { Text } from '@/shared/components/ui/text';

/**
 * "Not now" inside the Routine step card: the same pill as the main button,
 * with no fill, only a brand-colored outline.
 */
export function LaterButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Button
      variant="outline"
      size="lg"
      accessibilityLabel={label}
      onPress={onPress}
      className="border-brand/60 active:bg-brand-subtle min-h-button h-auto self-stretch rounded-full border bg-transparent px-6 py-2.5 shadow-none dark:bg-transparent"
    >
      <Text className="text-link text-body font-semibold">{label}</Text>
    </Button>
  );
}
