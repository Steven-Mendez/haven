import { ChevronDown, ChevronUp } from 'lucide-react-native';
import { type ReactNode, useState } from 'react';
import { View } from 'react-native';
import { Button } from '@/shared/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/shared/components/ui/collapsible';
import { Icon } from '@/shared/components/ui/icon';
import { Text } from '@/shared/components/ui/text';

export function More({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" className="min-h-touch h-auto justify-between rounded-lg px-0">
          <Text className="text-body font-medium">{label}</Text>
          <Icon as={open ? ChevronUp : ChevronDown} size={20} className="text-muted-foreground" />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <View className="gap-4 pt-2">{children}</View>
      </CollapsibleContent>
    </Collapsible>
  );
}
