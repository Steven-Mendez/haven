import { ChevronDown, ChevronRight } from 'lucide-react-native';
import { type ReactNode, useState } from 'react';
import { Platform, View } from 'react-native';

import { Button } from '@/shared/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/shared/components/ui/collapsible';
import { Icon } from '@/shared/components/ui/icon';
import { Text } from '@/shared/components/ui/text';
import { useTexts } from '@/shared/i18n';
import { cn } from '@/shared/lib/utils';

import { format, havenTexts } from './i18n';
import { LevelSymbol } from './level-symbol';

type Props = {
  count: number;
  label?: string;
  level?: 'green' | 'pending' | null;
  children: ReactNode;
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
};

export function CollapsedGroup({
  count,
  label,
  level = 'green',
  children,
  defaultOpen = false,
  open,
  onOpenChange,
  className,
}: Props) {
  const t = useTexts(havenTexts);
  const [inner, setInner] = useState(defaultOpen);
  const isOpen = open ?? inner;
  const setOpen = (v: boolean) => {
    setInner(v);
    onOpenChange?.(v);
  };
  const text = label ?? format(t.inRangeGroup, { n: count });

  return (
    <Collapsible open={isOpen} onOpenChange={setOpen} className={cn('gap-2', className)}>
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          accessibilityRole="button"
          accessibilityLabel={text}
          accessibilityState={{ expanded: isOpen }}
          className={cn(
            'border-border min-h-row h-auto justify-start gap-3 rounded-lg border px-4 py-0 sm:h-auto',
            Platform.select({ web: 'has-[>svg]:px-4' }),
          )}
        >
          {level ? <LevelSymbol level={level} size={10} /> : null}
          <Text className="text-body-sm text-muted-foreground group-active:text-muted-foreground flex-1 font-medium tabular-nums">
            {text}
          </Text>
          <Icon
            as={isOpen ? ChevronDown : ChevronRight}
            size={18}
            className="text-muted-foreground group-active:text-muted-foreground"
          />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <View>{children}</View>
      </CollapsibleContent>
    </Collapsible>
  );
}
