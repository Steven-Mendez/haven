import Storage from 'expo-sqlite/kv-store';
import { Hand, X } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';
import { Button } from '@/shared/components/ui/button';
import { Icon } from '@/shared/components/ui/icon';
import { Text } from '@/shared/components/ui/text';

const KEY = 'haven.coach.body-figure.v1';

function seen(): boolean {
  try {
    return Storage.getItemSync(KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * First-run coach mark under the organ figure: one line, dismissible, shown once (kv-store).
 * After it is dismissed, a quiet hint line takes its place.
 */
export function CoachMark({ text, dismissLabel }: { text: string; dismissLabel: string }) {
  const [open, setOpen] = useState(() => !seen());
  const dismiss = () => {
    setOpen(false);
    try {
      Storage.setItemSync(KEY, '1');
    } catch {
      // Not persisted: it shows again next launch, which is harmless.
    }
  };
  if (!open) return null;
  return (
    <View
      accessibilityLiveRegion="polite"
      className="bg-elevated border-border flex-row items-center gap-3 rounded-lg border py-2 pr-1 pl-4"
    >
      <Icon as={Hand} size={18} strokeWidth={1.75} className="text-brand" />
      <Text className="text-body-sm flex-1">{text}</Text>
      <Button
        variant="ghost"
        accessibilityRole="button"
        accessibilityLabel={dismissLabel}
        onPress={dismiss}
        className="min-h-touch min-w-touch h-auto rounded-full p-0 active:bg-transparent active:opacity-60 sm:h-auto"
      >
        <Icon
          as={X}
          size={16}
          className="text-muted-foreground group-active:text-muted-foreground"
        />
      </Button>
    </View>
  );
}
