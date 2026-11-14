import * as SwitchPrimitives from '@rn-primitives/switch';
import { Platform } from 'react-native';
import { cn } from '@/shared/lib/utils';

function Switch({ className, ...props }: React.ComponentProps<typeof SwitchPrimitives.Root>) {
  return (
    <SwitchPrimitives.Root
      className={cn(
        'flex h-[30px] w-[50px] shrink-0 flex-row items-center rounded-full border border-transparent px-0.5',
        Platform.select({
          web: 'focus-visible:border-ring focus-visible:ring-ring/50 peer inline-flex outline-none transition-all focus-visible:ring-[3px] disabled:cursor-not-allowed',
        }),
        props.checked ? 'bg-brand' : 'bg-muted border-border-strong',
        props.disabled && 'opacity-50',
        className,
      )}
      {...props}
    >
      <SwitchPrimitives.Thumb
        className={cn(
          'size-[26px] rounded-full bg-white transition-transform',
          Platform.select({
            web: 'pointer-events-none block ring-0',
          }),
          props.checked ? 'translate-x-[18px]' : 'translate-x-0',
        )}
      />
    </SwitchPrimitives.Root>
  );
}

export { Switch };
