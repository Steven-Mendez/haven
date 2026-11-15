'use client';

import type { CrewPlan, Medication } from '@haven/core';
import { Pencil } from 'lucide-react';
import { useState } from 'react';
import { Hint } from '@/components/haven';
import { buttonVariants } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { format, type Language } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { texts } from '../i18n';
import { MedicationPlanForm } from './medication-plan-form';

/** Pencil button that opens the crew member's plan editor in a side panel. */
export function MedicationPlanSheet({
  crewMember,
  name,
  plan,
  catalog,
  schedules,
  lang,
}: {
  crewMember: string;
  name: string;
  plan: CrewPlan;
  catalog: Medication[];
  schedules: Record<string, string>;
  lang: Language;
}) {
  const t = texts[lang];
  const [open, setOpen] = useState(false);
  const label = `${t.editPlan} · ${name}`;
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
            <SheetTitle>{format(t.planSheetTitle, { name })}</SheetTitle>
            <SheetDescription>{t.medicationDescription}</SheetDescription>
          </div>
          <MedicationPlanForm
            crewMember={crewMember}
            plan={plan}
            catalog={catalog}
            schedules={schedules}
            lang={lang}
          />
        </SheetContent>
      </Sheet>
    </>
  );
}
