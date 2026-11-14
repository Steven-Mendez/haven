import * as DialogPrimitive from '@rn-primitives/dialog';
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Dialog, DialogOverlay, DialogPortal } from '@/shared/components/ui/dialog';
import { cn } from '@/shared/lib/utils';

export function BottomSheet({
  open,
  onClose,
  className,
  children,
}: {
  open: boolean;
  onClose: () => void;
  className?: string;
  children: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogPortal>
        <DialogOverlay className="items-stretch justify-end bg-black/60 p-0">
          <DialogPrimitive.Content
            className={cn(
              'bg-elevated border-border gap-4 rounded-t-xl border-t px-5 pt-3',
              className,
            )}
            style={{ paddingBottom: insets.bottom + 16 }}
          >
            <View aria-hidden className="bg-border-strong h-1 w-9 self-center rounded-full" />
            {children}
          </DialogPrimitive.Content>
        </DialogOverlay>
      </DialogPortal>
    </Dialog>
  );
}
