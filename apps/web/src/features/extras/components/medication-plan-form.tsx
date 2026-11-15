'use client';

import type { CrewPlan, Medication } from '@haven/core';
import { useActionState, useEffect } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { Language } from '@/lib/i18n';
import { sendMedicationPlan } from '../actions';
import { texts } from '../i18n';
import type { MedicationFormState } from '../types';

const INITIAL: MedicationFormState = { status: 'idle' };

export function MedicationPlanForm({
  crewMember,
  plan,
  catalog,
  schedules,
  lang,
}: {
  crewMember: string;
  plan: CrewPlan;
  catalog: Medication[];
  /** Readable schedule of each medication, by id. */
  schedules: Record<string, string>;
  lang: Language;
}) {
  const t = texts[lang];
  const [state, action, pending] = useActionState(sendMedicationPlan, INITIAL);
  useEffect(() => {
    if (state.status === 'ok') toast.success(t.planSaved);
    if (state.status === 'error') toast.error(t.planError);
  }, [state, t]);

  return (
    <form action={action} className="flex flex-col gap-3" data-testid={`plan-form-${crewMember}`}>
      <input type="hidden" name="crewMember" value={crewMember} />
      <ul className="flex flex-col divide-y rounded-lg border">
        {catalog.map((m) => {
          const assigned = plan.medications.find((a) => a.medication === m.id);
          return (
            <li key={m.id} className="flex flex-col gap-2 px-3 py-2.5">
              <label className="flex cursor-pointer items-start gap-2.5">
                <input
                  type="checkbox"
                  name="medication"
                  value={m.id}
                  defaultChecked={Boolean(assigned)}
                  className="accent-primary mt-0.5 size-4"
                />
                <span className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium">{m.name[lang]}</span>
                  <span className="text-muted-foreground text-xs">
                    {schedules[m.id]} · {m.purpose[lang]}
                  </span>
                </span>
              </label>
              <div className="grid gap-2 pl-6.5 sm:grid-cols-[10rem_1fr]">
                <Input
                  type="date"
                  name={`until-${m.id}`}
                  defaultValue={assigned?.until ?? ''}
                  aria-label={`${m.name[lang]}: ${t.untilLabel}`}
                  className="h-8 text-xs"
                />
                <Input
                  name={`note-${m.id}`}
                  defaultValue={assigned?.note ?? ''}
                  maxLength={200}
                  placeholder={t.noteLabel}
                  aria-label={`${m.name[lang]}: ${t.noteLabel}`}
                  className="h-8 text-xs"
                />
              </div>
            </li>
          );
        })}
      </ul>
      <Button type="submit" size="sm" disabled={pending} className="self-start">
        {t.savePlan}
      </Button>
    </form>
  );
}
