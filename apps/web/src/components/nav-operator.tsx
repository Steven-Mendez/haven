import { OperatorMenu } from '@/components/operator-menu';
import type { Language } from '@/lib/i18n';

/**
 * Sidebar footer: operator on duty (Lucía Morales, mission control) on one 32 px row (Linear account row).
 * Language and theme live in Settings, reached from this row's menu.
 */
export function NavOperator({ lang }: { lang: Language }) {
  return (
    <div className="flex items-center border-t pt-2 group-data-[collapsible=icon]:border-t-0">
      {/* Operator row → menu with Profile, Settings and Keyboard shortcuts (/settings). */}
      <OperatorMenu lang={lang} />
    </div>
  );
}
