'use client';

import { classifySample, type SampleLevel, sampleConfig } from '@haven/core';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { LevelGlyph } from '@/components/haven';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { format, type Language } from '@/lib/i18n';
import { sendSampleResult } from '../actions';
import { texts } from '../i18n';
import { RESULT_LEVEL } from '../logic/samples';

const parse = (raw: string) => {
  const v = Number(raw.trim().replace(',', '.'));
  return raw.trim() && Number.isFinite(v) ? v : undefined;
};

export function SampleResultForm({
  id,
  sample,
  lang,
}: {
  id: string;
  sample: string;
  lang: Language;
}) {
  const t = texts[lang];
  const type = sampleConfig.samples.find((s) => s.id === sample);
  const [pending, startTransition] = useTransition();
  const [raw, setRaw] = useState<Record<string, string>>({});
  const [override, setOverride] = useState<'' | SampleLevel>('');
  const values = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, parse(v)]));
  const { level, flags } = type ? classifySample(type, values) : { level: undefined, flags: [] };
  const final = override || level;
  const label = (l: SampleLevel) =>
    ({ normal: t.resultNormal, abnormal: t.resultAbnormal, critical: t.resultCritical })[l];

  // The saved sample leaves the pending list and this form unmounts, so the
  // toast is shown from the action's result rather than from component state.
  const submit = (form: FormData) =>
    startTransition(async () => {
      const result = await sendSampleResult({ status: 'idle' }, form);
      if (result.status === 'ok') toast.success(t.resultSaved);
      else toast.error(t.resultError);
    });

  return (
    <form action={submit} className="flex flex-col gap-3" data-testid={`result-${id}`}>
      <input type="hidden" name="id" value={id} />
      <div className="grid gap-2 sm:grid-cols-2">
        {type?.analytes.map((a) => {
          const flag = flags.find((f) => f.analyte === a.id);
          return (
            <label key={a.id} htmlFor={`${id}-${a.id}`} className="flex flex-col gap-1 text-xs">
              <span className="flex items-center gap-1.5">
                {flag ? <LevelGlyph level={RESULT_LEVEL[flag.level]} size={8} /> : null}
                <span className="font-medium">{a.name[lang]}</span>
                <span className="text-muted-foreground">
                  ({a.unit}, {format(t.referenceRange, { min: a.green[0], max: a.green[1] })})
                </span>
              </span>
              <Input
                id={`${id}-${a.id}`}
                name={`value-${a.id}`}
                inputMode="decimal"
                value={raw[a.id] ?? ''}
                onChange={(e) => setRaw((r) => ({ ...r, [a.id]: e.target.value }))}
                className="h-8 text-xs tabular-nums"
              />
            </label>
          );
        })}
      </div>
      <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
        {level ? <LevelGlyph level={RESULT_LEVEL[level]} size={10} /> : null}
        {level ? format(t.computedLevel, { level: label(level) }) : t.computedNone}
      </p>
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-xs">
          <span className="font-medium">{t.overrideLabel}</span>
          <select
            name="override"
            value={override}
            onChange={(e) => setOverride(e.target.value as '' | SampleLevel)}
            className="border-input bg-background h-8 rounded-md border px-2 text-xs"
          >
            <option value="">
              {t.overrideAuto}
              {level ? ` (${label(level)})` : ''}
            </option>
            <option value="normal">{t.resultNormal}</option>
            <option value="abnormal">{t.resultAbnormal}</option>
            <option value="critical">{t.resultCritical}</option>
          </select>
        </label>
        <Input
          name="detail"
          maxLength={280}
          placeholder={t.detailLabel}
          aria-label={t.detailLabel}
          className="h-8 min-w-56 flex-1 text-xs"
        />
        <Button type="submit" size="sm" disabled={pending || !final}>
          {t.saveResult}
        </Button>
      </div>
    </form>
  );
}
