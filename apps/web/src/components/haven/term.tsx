import { explainTerm } from '@haven/core';
import type { Language } from '@/lib/i18n';
import { type TermExplanation, TermTip } from './term-tip';

type TipProps = Parameters<typeof TermTip>[0];

/**
 * `<Term id="systolic-bp" lang={lang}>Presión arterial sistólica</Term>`: the single way to explain a term.
 * Resolves the text from the shared glossary (`packages/core/config/glossary.json`); never hardcode medical
 * explanations in the web app. Server-safe; in client components pass `explain(id, lang)` to `TermTip`.
 */
export function Term({
  id,
  lang,
  ...props
}: Omit<TipProps, 'explanation'> & { id: string; lang: Language }) {
  return <TermTip explanation={explainTerm(id, lang)} {...props} />;
}

/** Resolves a glossary entry for a client component (serialisable). */
export function explain(id: string, lang: Language): TermExplanation | undefined {
  return explainTerm(id, lang);
}
