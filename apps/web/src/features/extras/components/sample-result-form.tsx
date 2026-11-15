'use client';

import { useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { Language } from '@/lib/i18n';
import { sendSampleResult } from '../actions';
import { texts } from '../i18n';

export function SampleResultForm({ id, lang }: { id: string; lang: Language }) {
  const t = texts[lang];
  const [pending, startTransition] = useTransition();

  // The saved sample leaves the pending list and this form unmounts, so the
  // toast is shown from the action's result rather than from component state.
  const submit = (form: FormData) =>
    startTransition(async () => {
      const result = await sendSampleResult({ status: 'idle' }, form);
      if (result.status === 'ok') toast.success(t.resultSaved);
      else toast.error(t.resultError);
    });

  return (
    <form
      action={submit}
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
