import { OperatorMenu } from '@/components/operator-menu';
import type { Language } from '@/lib/i18n';

export function NavOperator({ lang }: { lang: Language }) {
  return (
    <div className="flex items-center">
      <OperatorMenu lang={lang} />
    </div>
  );
}
