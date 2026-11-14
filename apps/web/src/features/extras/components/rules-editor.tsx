'use client';

import { ChevronRight, CircleAlert, CircleHelp, Send } from 'lucide-react';
import { type ReactNode, useActionState, useState } from 'react';
import { havenTexts, LevelBadge } from '@/components/haven';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Field, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { format, type Language, textsFor, translate } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { sendRulesVersion } from '../actions';
import { texts } from '../i18n';
import type { EditableIndicator, EditableRule, ThresholdError } from '../logic/rules';
import type { RulesFormState } from '../types';
import { FormError, INVALID_INPUT } from './form-error';

type Props = {
  lang: Language;
  indicators: EditableIndicator[];
  currentVersion: string;
  environmentNames: Record<string, string>;
  defaultAuthor: string;
  initialIndicator?: string;
  bare?: boolean;
};

const INITIAL: RulesFormState = { status: 'idle' };

function initialValues(indicator: EditableIndicator | undefined): Record<string, string> {
  if (!indicator) return {};
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
  indicators,
  currentVersion,
  environmentNames,
  defaultAuthor,
  initialIndicator,
  bare,
}: Props) {
  const t = textsFor(texts, lang);
  const [state, action, pending] = useActionState(sendRulesVersion, INITIAL);
  const [indicatorId, setIndicatorId] = useState(
    indicators.find((i) => i.id === initialIndicator)?.id ??
      indicators.find((i) => i.id === 'glucose')?.id ??
      indicators[0]?.id ??
      '',
  );
  const indicator = indicators.find((i) => i.id === indicatorId);
  const [values, setValues] = useState(() => initialValues(indicator));
  const [open, setOpen] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [author, setAuthor] = useState(defaultAuthor);

  const choose = (id: string) => {
    setIndicatorId(id);
    setValues(initialValues(indicators.find((i) => i.id === id)));
    setOpen(null);
  };
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

  const unit = indicator?.unit ?? '';
  const items = indicators.map((i) => ({ value: i.id, label: translate(i.name, lang) }));
  const overrides = indicator?.overrides.map((e) => environmentNames[e] ?? e) ?? [];
  const rangeText = (prefix: string) =>
    `${values[`${prefix}-min`] ?? '?'}–${values[`${prefix}-max`] ?? '?'}${unit ? ` ${unit}` : ''}`;

  const inputs = (prefix: string, error?: string) => (
    <div className="grid grid-cols-2 gap-3">
      {(['min', 'max'] as const).map((side) => {
        const name = `${prefix}-${side}`;
        return (
          <Field key={name}>
            <FieldLabel htmlFor={name} className="text-muted-foreground text-xs font-normal">
              {side === 'min' ? t.min : t.max}
              {unit ? ` · ${unit}` : ''}
            </FieldLabel>
            <Input
              id={name}
              name={name}
              inputMode="decimal"
              autoComplete="off"
              className={cn('tabular-nums', INVALID_INPUT)}
              aria-invalid={error ? true : undefined}
              value={values[name] ?? ''}
              onChange={(e) => setValues((v) => ({ ...v, [name]: e.target.value }))}
              required
            />
          </Field>
        );
      })}
    </div>
  );

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
          <LevelBadge level={r.level} lang={lang} size="sm" />
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
          {inputs(prefix, error)}
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
    <Card
      className={cn(
        'gap-0 pb-0',
        bare && 'min-h-0 flex-1 overflow-y-auto rounded-none bg-transparent pt-0 ring-0',
      )}
    >
      <CardHeader className={cn('pb-4', bare && 'sr-only')}>
        <CardTitle>{t.editorTitle}</CardTitle>
        <CardDescription>
          {format(t.editorDescription, { version: currentVersion })}
        </CardDescription>
      </CardHeader>
      <form action={action} className="flex flex-col">
        <CardContent className="flex flex-col gap-5 pb-5">
          <Field>
            <FieldLabel htmlFor="rules-indicator">{t.indicator}</FieldLabel>
            <Select
              name="indicator"
              items={items}
              value={indicatorId}
              onValueChange={(v) => {
                if (typeof v === 'string') choose(v);
              }}
            >
              <SelectTrigger id="rules-indicator" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {items.map((i) => (
                  <SelectItem key={i.value} value={i.value}>
                    {i.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {overrides.length ? (
              <p className="text-muted-foreground text-xs">
                {format(t.overrideNotice, { environments: overrides.join(', ') })}
              </p>
            ) : null}
          </Field>

          {indicator ? (
            <SettingsGroup title={t.greenRange} hint={t.greenRangeHint}>
              <div className="flex flex-col gap-2 p-4">
                {inputs('green', greenError)}
                {greenError ? <FormError>{greenError}</FormError> : null}
              </div>
            </SettingsGroup>
          ) : null}

          {indicator ? (
            <SettingsGroup title={t.rulesTitle} hint={t.rulesHint}>
              {indicator.rules.length ? (
                indicator.rules.map(ruleRow)
              ) : (
                <p className="text-muted-foreground p-4 text-sm">{t.noRangeRules}</p>
              )}
            </SettingsGroup>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
            <Field>
              <FieldLabel htmlFor="rules-note">{t.note}</FieldLabel>
              <Input
                id="rules-note"
                name="note"
                maxLength={500}
                placeholder={t.notePlaceholder}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="rules-author">{t.author}</FieldLabel>
              <Input
                id="rules-author"
                name="author"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                maxLength={80}
              />
            </Field>
          </div>
        </CardContent>

        <div
          className={cn(
            'bg-card sticky bottom-0 flex flex-wrap items-center gap-3 border-t px-4 py-3',
            bare ? 'bg-popover' : 'rounded-b-xl',
          )}
        >
          {pending || !indicator ? (
            <Tooltip>
              <TooltipTrigger render={<Button type="submit" disabled focusableWhenDisabled />}>
                <Send data-icon="inline-start" />
                {pending ? t.submittingRules : t.submitRules}
              </TooltipTrigger>
              <TooltipContent>
                {pending ? havenTexts[lang].disabledSending : havenTexts[lang].disabledNoIndicator}
              </TooltipContent>
            </Tooltip>
          ) : (
            <Button type="submit">
              <Send data-icon="inline-start" />
              {t.submitRules}
            </Button>
          )}
          <div aria-live="polite" className="text-sm">
            {state.status === 'ok' ? (
              <span className="text-muted-foreground">
                {format(t.rulesSent, { version: state.version })}
              </span>
            ) : formMessage ? (
              <FormError>{formMessage}</FormError>
            ) : null}
          </div>
        </div>
      </form>
    </Card>
  );
}

function SettingsGroup({
  title,
  hint,
  children,
}: {
  title: string;
  hint: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex flex-col">
        <h3 className="text-sm font-medium">{title}</h3>
        <p className="text-muted-foreground text-xs">{hint}</p>
      </div>
      <div className="overflow-hidden rounded-lg border">{children}</div>
    </section>
  );
}
