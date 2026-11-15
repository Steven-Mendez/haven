'use client';

import { useActionState, useEffect } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { Language } from '@/lib/i18n';
import { sendSampleResult } from '../actions';
import { texts } from '../i18n';
import type { SampleResultFormState } from '../types';

const INITIAL: SampleResultFormState = { status: 'idle' };

export function SampleResultForm({ id, lang }: { id: string; lang: Language }) {
  const t = texts[lang];
  const [state, action, pending] = useActionState(sendSampleResult, INITIAL);
  useEffect(() => {
    if (state.status === 'ok') toast.success(t.resultSaved);
    if (state.status === 'error') toast.error(t.resultError);
  }, [state, t]);

  return (
    <form
      action={action}
      className="flex flex-wrap items-center gap-2"
      data-testid={`result-${id}`}
    >
      <input type="hidden" name="id" value={id} />
      <fieldset className="flex items-center gap-3 text-xs">
        <legend className="sr-only">{t.resultLabel}</legend>
        <label className="flex items-center gap-1.5">
          <input
            type="radio"
            name="result"
            value="normal"
            defaultChecked
            className="accent-primary"
          />
          {t.resultNormal}
        </label>
        <label className="flex items-center gap-1.5">
          <input type="radio" name="result" value="abnormal" className="accent-primary" />
          {t.resultAbnormal}
        </label>
      </fieldset>
      <Input
        name="detail"
        maxLength={280}
        placeholder={t.detailLabel}
        aria-label={t.detailLabel}
        className="h-8 w-56 text-xs"
      />
      <Button type="submit" size="sm" disabled={pending}>
        {t.saveResult}
      </Button>
    </form>
  );
}
