import { CircleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Validation message without red (DESIGN_SYSTEM.md 3.6: red means health): alert icon + primary text.
 */
export function FormError({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p role="alert" className={cn('text-foreground flex items-start gap-1.5 text-sm', className)}>
      <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

/** Neutral emphasis for an input with `aria-invalid` (replaces the destructive border and ring). */
export const INVALID_INPUT =
  'aria-invalid:border-foreground/60 aria-invalid:ring-foreground/15 dark:aria-invalid:border-foreground/60 dark:aria-invalid:ring-foreground/15';
