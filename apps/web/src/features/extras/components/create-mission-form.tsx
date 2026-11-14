'use client';

import { Plus } from 'lucide-react';
import Link from 'next/link';
import { useActionState, useState } from 'react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Field, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { format, type Language, textsFor } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { createMissionAction } from '../actions';
import { texts } from '../i18n';
import type { TemplateOption } from '../logic/plan-options';
import type { MissionFormState } from '../types';
import { FormError, INVALID_INPUT } from './form-error';
import { PhaseBar } from './phase-bar';

const INITIAL: MissionFormState = { status: 'idle' };

/**
 * «New mission» (Linear «New project», Notion templates): a name and an optional base plan, nothing else. The
 * mission is created in preparation and its page opens, where the plan, the start and the crew are set up.
 */
export function CreateMissionForm({
  lang,
  templates,
}: {
  lang: Language;
  /** Real mission plans; «From scratch» is added at the end. */
  templates: (TemplateOption & { phaseNames: string[] })[];
}) {
  const t = textsFor(texts, lang);
  const [state, action, pending] = useActionState(createMissionAction, INITIAL);
  const [template, setTemplate] = useState('scratch');
  const options = [
    ...templates,
    {
      id: 'scratch',
      name: t.fromScratch,
      description: t.fromScratchDescription,
      phases: [],
      phaseNames: [],
    },
  ];
  const nameInvalid = state.status === 'error' && state.fields.includes('name');

  return (
    <form action={action} className="flex max-w-2xl flex-col gap-6">
      <input type="hidden" name="template" value={template} />
      <Field>
        <FieldLabel htmlFor="mission-name">{t.missionName}</FieldLabel>
        <Input
          id="mission-name"
          name="name"
          required
          maxLength={80}
          autoComplete="off"
          placeholder={t.missionNamePlaceholder}
          className={cn('h-9', INVALID_INPUT)}
          aria-invalid={nameInvalid || undefined}
        />
        {nameInvalid ? <FormError>{t.errName}</FormError> : null}
      </Field>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">{t.basePlan}</legend>
        <p className="text-muted-foreground mb-1 text-xs">{t.basePlanHint}</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {options.map((o) => {
            const days = o.phases.reduce((n, p) => n + p.days, 0);
            return (
              <label
                key={o.id}
                className={cn(
                  'hover:bg-hover flex cursor-pointer flex-col gap-2 rounded-xl border p-3 transition-colors',
                  template === o.id && 'border-brand bg-hover',
                )}
              >
                <span className="flex items-start gap-2">
                  <input
                    type="radio"
                    name="template-choice"
                    value={o.id}
                    checked={template === o.id}
                    onChange={() => setTemplate(o.id)}
                    className="accent-brand mt-0.5"
                  />
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-sm font-medium">{o.name}</span>
                    <span className="text-muted-foreground text-xs leading-5">{o.description}</span>
                  </span>
                </span>
                {o.phases.length ? (
                  <>
                    <PhaseBar phases={o.phases} names={o.phaseNames} />
                    <span className="text-tertiary text-xs tabular-nums">
                      {format(t.daysTotal, { n: days })} ·{' '}
                      {format(t.phasesCount, { n: o.phases.length })}
                    </span>
                  </>
                ) : null}
              </label>
            );
          })}
        </div>
      </fieldset>

      {state.status === 'error' && state.message ? <FormError>{t.errCreate}</FormError> : null}
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          <Plus data-icon="inline-start" />
          {pending ? t.creatingMission : t.createMission}
        </Button>
        <Link href="/missions" className={buttonVariants({ variant: 'ghost' })}>
          {t.cancel}
        </Link>
      </div>
    </form>
  );
}
