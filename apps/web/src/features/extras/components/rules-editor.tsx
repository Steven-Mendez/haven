'use client';

import { ChevronRight, CircleAlert, CircleHelp } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type ReactNode, useActionState, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { havenTexts } from '@/components/haven';
import { Button, buttonVariants } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Field, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { format, type Language, textsFor, translate } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { sendRulesVersion } from '../actions';
import { texts } from '../i18n';
import type { RangeControl } from '../logic/range-control';
import type { EditableIndicator, EditableRule, ThresholdError } from '../logic/rules';
import type { RulesFormState } from '../types';
import { FormError } from './form-error';
import { RangeScale } from './range-scale';
import { ThresholdRangeInput } from './threshold-range-input';

type Props = {
  lang: Language;
  indicator: EditableIndicator;
  control: RangeControl;
  environmentNames: Record<string, string>;
  author: string;
  backHref: string;
};

const INITIAL: RulesFormState = { status: 'idle' };

function initialValues(indicator: EditableIndicator): Record<string, string> {
  const values: Record<string, string> = {
    'green-min': String(indicator.green[0]),
    'green-max': String(indicator.green[1]),
  };
  for (const r of indicator.rules) {
    values[`rule-${r.index}-min`] = String(r.outside[0]);
    values[`rule-${r.index}-max`] = String(r.outside[1]);
  }
  return values;
}

export function RulesEditor({
  lang,
  indicator,
  control,
  environmentNames,
  author,
  backHref,
}: Props) {
  const t = textsFor(texts, lang);
  const router = useRouter();
  const [state, action, pending] = useActionState(sendRulesVersion, INITIAL);
  const [values, setValues] = useState(() => initialValues(indicator));
  const [open, setOpen] = useState<string | null>(null);
  const [note, setNote] = useState('');

  const sent = state.status === 'ok' ? state.version : undefined;
  useEffect(() => {
    if (!sent) return;
    toast.success(format(t.rulesSent, { version: sent }));
    router.push(backHref);
  }, [sent, t, router, backHref]);

  const errors: ThresholdError[] = state.status === 'error' ? state.errors : [];
  const errorFor = (field: string) => {
    const e = errors.find((x) => x.field === field);
    if (!e) return undefined;
    switch (e.code) {
      case 'number':
        return t.errNumber;
      case 'order':
        return t.errOrder;
      case 'contains':
        return format(t.errContains, { min: values['green-min'], max: values['green-max'] });
      case 'engine':
        return t.errEngine;
      default:
        return t.errUnknownIndicator;
    }
  };
  const formMessage =
    state.status === 'error' && state.message === 'mission'
      ? t.errMission
      : state.status === 'error' && state.message === 'save'
        ? t.errSave
        : (errorFor('indicator') ?? (errors.length ? t.errReview : undefined));

  const unit = indicator.unit;
  const overrides = indicator.overrides.map((e) => environmentNames[e] ?? e);
  const rangeText = (prefix: string) =>
    `${values[`${prefix}-min`] ?? '?'}–${values[`${prefix}-max`] ?? '?'}${unit ? ` ${unit}` : ''}`;

  const inputs = (prefix: string, error?: string, tone?: 'green' | 'amber' | 'red') => (
    <ThresholdRangeInput
      prefix={prefix}
      control={control}
      values={values}
      onChange={(name, value) => setValues((v) => ({ ...v, [name]: value }))}
      labels={{ min: t.min, max: t.max }}
      unit={unit}
      invalid={Boolean(error)}
      tone={tone}
    />
  );

  // Vista previa en vivo: la misma barra de la tabla, con los valores que se están editando.
  const num = (k: string, fallback: number) => {
    const n = Number(String(values[k] ?? '').replace(',', '.'));
    return values[k]?.trim() && Number.isFinite(n) ? n : fallback;
  };
  const preview: EditableIndicator = {
    ...indicator,
    green: [num('green-min', indicator.green[0]), num('green-max', indicator.green[1])],
    rules: indicator.rules.map((r) => ({
      ...r,
      outside: [num(`rule-${r.index}-min`, r.outside[0]), num(`rule-${r.index}-max`, r.outside[1])],
    })),
  };
  const scaleTexts = {
    below: t.scaleBelow,
    above: t.scaleAbove,
    between: t.scaleBetween,
    levels: { green: t.scaleGreen, amber: t.scaleAmber, red: t.scaleRed },
  };

  const ruleRow = (r: EditableRule, n: number) => {
    const prefix = `rule-${r.index}`;
    const error = errorFor(prefix);
    const isOpen = open === prefix || Boolean(error);
    return (
      <Collapsible
        key={prefix}
        open={isOpen}
        onOpenChange={(next) => setOpen(next ? prefix : null)}
        className="border-border border-t first:border-t-0"
      >
        <CollapsibleTrigger
          className={cn(
            'hover:bg-hover flex min-h-10 w-full items-center gap-3 px-4 py-2 text-left text-sm',
            error && 'font-medium',
          )}
        >
          {error ? <CircleAlert aria-label={t.errorIcon} className="size-4 shrink-0" /> : null}
          <span className="font-medium">{format(t.ruleRange, { n: n + 1 })}</span>
          <span className="numeric text-muted-foreground">{rangeText(prefix)}</span>
          {r.withSymptoms ? (
            <span className="text-muted-foreground hidden text-xs sm:inline">{t.withSymptoms}</span>
          ) : null}
          <ChevronRight
            aria-hidden="true"
            className={cn(
              'text-muted-foreground ml-auto size-4 transition-transform',
              isOpen && 'rotate-90',
            )}
          />
        </CollapsibleTrigger>
        <CollapsibleContent keepMounted className="flex flex-col gap-3 px-4 pb-4">
          <p className="text-muted-foreground text-xs">{t.ruleRangeHint}</p>
          {inputs(prefix, error, r.level)}
          {error ? <FormError>{error}</FormError> : null}
          <Collapsible>
            <CollapsibleTrigger
              render={<Button type="button" variant="ghost" size="sm" className="-ml-2 w-fit" />}
            >
              <CircleHelp data-icon="inline-start" />
              {t.why}
            </CollapsibleTrigger>
            <CollapsibleContent className="text-muted-foreground pt-1 text-sm">
              {translate(r.explanation, lang)}
            </CollapsibleContent>
          </Collapsible>
        </CollapsibleContent>
      </Collapsible>
    );
  };

  const greenError = errorFor('green');

  return (
    <form action={action} className="flex max-w-2xl flex-col gap-6">
      <input type="hidden" name="indicator" value={indicator.id} />
      {overrides.length ? (
        <p className="text-muted-foreground text-xs">
          {format(t.overrideNotice, { environments: overrides.join(', ') })}
        </p>
      ) : null}

      {indicator.rules.length ? (
        <div className="bg-background sticky top-2 z-10 flex flex-col gap-1 rounded-lg border px-4 py-3 shadow-sm">
          <span className="text-muted-foreground text-xs">{t.colCondition}</span>
          <RangeScale indicator={preview} label={t.colCondition} texts={scaleTexts} />
        </div>
      ) : null}

      <SettingsGroup title={t.scaleGreen} hint={t.levelGreenHint} level="green">
        <div className="flex flex-col gap-2 p-4">
          {inputs('green', greenError)}
          {greenError ? <FormError>{greenError}</FormError> : null}
        </div>
      </SettingsGroup>

      {(['amber', 'red'] as const).map((level) => {
        const rules = indicator.rules.filter((r) => r.level === level);
        const name = level === 'amber' ? t.scaleAmber : t.scaleRed;
        return (
          <SettingsGroup
            key={level}
            title={name}
            hint={level === 'amber' ? t.levelAmberHint : t.levelRedHint}
            level={level}
          >
            {rules.length ? (
              rules.map((r) => ruleRow(r, indicator.rules.indexOf(r)))
            ) : (
              <p className="text-muted-foreground p-4 text-sm">{t.noLevelRules}</p>
            )}
          </SettingsGroup>
        );
      })}

      <Field>
        <FieldLabel htmlFor="rules-author">{t.author}</FieldLabel>
        <Input id="rules-author" value={author} disabled readOnly className="sm:w-64" />
      </Field>

      <Field>
        <FieldLabel htmlFor="rules-note">
          {t.note}
          <span className="text-muted-foreground font-normal">({t.optional})</span>
        </FieldLabel>
        <Textarea
          id="rules-note"
          name="note"
          maxLength={500}
          rows={4}
          className="min-h-28"
          placeholder={t.notePlaceholder}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </Field>

      <div className="flex flex-wrap items-center justify-end gap-3">
        <div aria-live="polite" className="mr-auto text-sm">
          {formMessage ? <FormError>{formMessage}</FormError> : null}
        </div>
        <Link href={backHref} className={buttonVariants({ variant: 'ghost' })}>
          {t.cancelEdit}
        </Link>
        {pending ? (
          <Tooltip>
            <TooltipTrigger render={<Button type="submit" disabled focusableWhenDisabled />}>
              {t.submittingRules}
            </TooltipTrigger>
            <TooltipContent>{havenTexts[lang].disabledSending}</TooltipContent>
          </Tooltip>
        ) : (
          <Button type="submit">{t.submitRules}</Button>
        )}
      </div>
    </form>
  );
}

function SettingsGroup({
  title,
  hint,
  level,
  children,
}: {
  title: string;
  hint: string;
  level?: 'green' | 'amber' | 'red';
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex flex-col">
        <h3 className="flex items-center gap-2 text-sm font-medium">
          {level ? (
            <span
              aria-hidden="true"
              className="h-2 w-4 rounded-full"
              style={{ background: `var(--scale-${level})` }}
            />
          ) : null}
          {title}
        </h3>
        <p className="text-muted-foreground text-xs">{hint}</p>
      </div>
      <div className="overflow-hidden rounded-lg border">{children}</div>
    </section>
  );
}
