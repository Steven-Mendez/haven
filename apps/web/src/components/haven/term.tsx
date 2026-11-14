import { explainTerm } from '@haven/core';
import type { Language } from '@/lib/i18n';
import { type TermExplanation, TermTip } from './term-tip';

type TipProps = Parameters<typeof TermTip>[0];

export function Term({
  id,
  lang,
  ...props
}: Omit<TipProps, 'explanation'> & { id: string; lang: Language }) {
  return <TermTip explanation={explainTerm(id, lang)} {...props} />;
}

export function explain(id: string, lang: Language): TermExplanation | undefined {
  return explainTerm(id, lang);
}
