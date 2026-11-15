'use client';

import { type ExercisePrescription, exercise } from '@haven/core';
import { Pencil } from 'lucide-react';
import { useActionState, useEffect, useId, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Hint } from '@/components/haven';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { format, type Language } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { sendExercisePrescription } from '../actions';
import { texts } from '../i18n';
import type { ExerciseFormState } from '../types';

const INITIAL: ExerciseFormState = { status: 'idle' };

function PrescriptionForm({
  crewMember,
  prescription,
  custom,
  lang,
  onSaved,
}: {
  crewMember: string;
  prescription: ExercisePrescription;
  custom: boolean;
  lang: Language;
  onSaved: () => void;
}) {
  const t = texts[lang];
  const id = useId();
  const [state, action, pending] = useActionState(sendExercisePrescription, INITIAL);
  const [minutes, days] = [exercise.limits.minutes, exercise.limits.daysPerWeek];
  // Each result is handled once, however often the sheet re-renders.
  const handled = useRef<ExerciseFormState>(INITIAL);
  useEffect(() => {
    if (state === handled.current) return;
    handled.current = state;
    if (state.status === 'ok') {
      toast.success(t.exSaved);
      onSaved();
    }
    if (state.status === 'error') {
      toast.error(
        format(t.exError, { min: minutes[0], max: minutes[1], dmin: days[0], dmax: days[1] }),
      );
    }
  }, [state, t, onSaved, minutes, days]);

  const field = (name: string, label: string, value: number, [min, max]: [number, number]) => (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={`${id}-${name}`} className="text-xs font-medium">
        {label}
      </label>
      <Input
        id={`${id}-${name}`}
        type="number"
        name={name}
        min={min}
        max={max}
        step={1}
        required
        inputMode="numeric"
        defaultValue={value}
        className="tabular-nums"
      />
    </div>
  );

  return (
    <form
      action={action}
      className="flex flex-col gap-4"
      data-testid={`exercise-form-${crewMember}`}
    >
      <input type="hidden" name="crewMember" value={crewMember} />
      <div className="grid gap-3 sm:grid-cols-3">
        {field('resistanceMinutes', t.exResistanceLabel, prescription.resistanceMinutes, minutes)}
        {field('aerobicMinutes', t.exAerobicLabel, prescription.aerobicMinutes, minutes)}
        {field('daysPerWeek', t.exDaysLabel, prescription.daysPerWeek, days)}
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${id}-note`} className="text-xs font-medium">
          {t.exNoteLabel}
        </label>
        <Input
          id={`${id}-note`}
          name="note"
          maxLength={200}
          defaultValue={prescription.note ?? ''}
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" name="intent" value="save" disabled={pending}>
          {t.exSave}
        </Button>
        {custom ? (
          <Button
            type="submit"
            name="intent"
            value="reset"
            variant="ghost"
            disabled={pending}
            formNoValidate
          >
            {t.exReset}
          </Button>
        ) : null}
      </div>
    </form>
  );
}

/** Pencil button that opens the crew member's exercise prescription in a side panel. */
export function ExercisePlanSheet({
  crewMember,
  name,
  prescription,
  custom,
  suggestion,
  assessment,
  lang,
}: {
  crewMember: string;
  name: string;
  prescription: ExercisePrescription;
  custom: boolean;
  /** Readable suggestion of the last self-assessment, if any. */
  suggestion?: string;
  assessment?: string;
  lang: Language;
}) {
  const t = texts[lang];
  const [open, setOpen] = useState(false);
  const label = `${t.exEditPrescription} · ${name}`;
  return (
    <>
      <Hint label={label} side="left">
        <button
          type="button"
          aria-label={label}
          onClick={() => setOpen(true)}
          className={cn(
            buttonVariants({ variant: 'ghost', size: 'icon-sm' }),
            'hit-area text-tertiary group-hover/row:text-foreground group-hover/row:bg-hover',
          )}
        >
          <Pencil />
        </button>
      </Hint>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          className="gap-5 overflow-y-auto p-5 data-[side=right]:w-full data-[side=right]:sm:max-w-[520px]"
        >
          <div className="flex flex-col gap-1">
            <SheetTitle>{format(t.exSheetTitle, { name })}</SheetTitle>
            <SheetDescription>{t.exSheetDescription}</SheetDescription>
          </div>
          {suggestion ? (
            <div className="bg-surface-elevated/60 flex flex-col gap-0.5 rounded-lg border px-3 py-2.5 text-xs">
              <span className="font-medium">{format(t.exSuggestionHint, { suggestion })}</span>
              {assessment ? <span className="text-muted-foreground">{assessment}</span> : null}
            </div>
          ) : null}
          <PrescriptionForm
            key={`${prescription.resistanceMinutes}-${prescription.aerobicMinutes}-${prescription.daysPerWeek}-${custom}`}
            crewMember={crewMember}
            prescription={prescription}
            custom={custom}
            lang={lang}
            onSaved={() => setOpen(false)}
          />
        </SheetContent>
      </Sheet>
    </>
  );
}
