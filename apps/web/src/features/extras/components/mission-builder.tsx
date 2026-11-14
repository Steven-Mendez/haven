'use client';

import type { I18n, MissionPhase } from '@haven/core';
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  ExternalLink,
  Home,
  Orbit,
  Plus,
  Radiation,
  RadioTower,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { type ReactNode, useActionState, useEffect, useState } from 'react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { format, formatDate, formatNumber, type Language, textsFor, translate } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { texts } from '../i18n';
import type { EnvironmentOption, TemplateOption } from '../logic/plan-options';
import type { MissionField, MissionFormState } from '../types';
import { FormError, INVALID_INPUT } from './form-error';
import { PhaseBar, phaseColor } from './phase-bar';

type Props = {
  lang: Language;
  environments: EnvironmentOption[];
  templates: TemplateOption[];
  today: string;
  submit: (previous: MissionFormState, form: FormData) => Promise<MissionFormState>;
  initial: {
    name: string;
    phases: MissionPhase[];
    startMode: StartMode;
    start: string;
  };
  cancelHref: string;
};

const INITIAL: MissionFormState = { status: 'idle' };
const SCRATCH: MissionPhase[] = [
  { environment: 'launch', days: 1 },
  { environment: 'reentry', days: 1 },
];
const STEP_OF: Record<MissionField, 1 | 2 | 3> = { phases: 2, name: 3, start: 3 };

export type StartMode = 'manual' | 'now' | 'date';
const START_MODES: StartMode[] = ['manual', 'now', 'date'];
const CHEST_XRAY_MSV = 0.1;

function delayOf(phase: MissionPhase, env: EnvironmentOption | undefined) {
  if (!env) return phase.delayMin ?? 0;
  const low = Math.min(env.delayMin, env.delayMax);
  const high = Math.max(env.delayMin, env.delayMax);
  return Math.min(high, Math.max(low, phase.delayMin ?? env.delayMin));
}

function dayRanges(phases: MissionPhase[]) {
  let day = 1;
  return phases.map((p) => {
    const range = { a: day, b: day + p.days - 1 };
    day += p.days;
    return range;
  });
}

export function MissionBuilder({
  lang,
  environments,
  templates,
  today,
  submit,
  initial,
  cancelHref,
}: Props) {
  const t = textsFor(texts, lang);
  const [state, action, pending] = useActionState(submit, INITIAL);
  const [step, setStep] = useState<1 | 2 | 3>(2);
  const [template, setTemplate] = useState('current');
  const [phases, setPhases] = useState<MissionPhase[]>(initial.phases);
  const [open, setOpen] = useState<number | null>(null);
  const [name, setName] = useState(initial.name);
  const [start, setStart] = useState(initial.start || today);
  const [startMode, setStartMode] = useState<StartMode>(initial.startMode);

  const scratch: TemplateOption = {
    id: 'scratch',
    name: t.fromScratch,
    description: t.fromScratchDescription,
    summary: t.fromScratchSummary,
    basedOn: t.fromScratchBasedOn,
    phases: SCRATCH,
  };
  const options = [...templates, scratch];
  const chosen = options.find((o) => o.id === template) ?? scratch;

  const env = (id: string) => environments.find((e) => e.id === id);
  const phaseName = (p: MissionPhase) =>
    p.label ? translate(p.label as I18n, lang) : (env(p.environment)?.name ?? p.environment);
  const total = phases.reduce((n, p) => n + p.days, 0);
  const phasesValid = phases.length > 0 && phases.every((p) => env(p.environment) && p.days >= 1);

  // biome-ignore lint/correctness/useExhaustiveDependencies: runs on step change only
  useEffect(() => {
    window.scrollTo({ top: 0 });
    document.getElementById('content')?.scrollTo({ top: 0 });
  }, [step]);

  useEffect(() => {
    if (state.status === 'error' && state.fields[0]) setStep(STEP_OF[state.fields[0]]);
  }, [state]);

  const invalid = (f: MissionField) => state.status === 'error' && state.fields.includes(f);
  const messages: Record<MissionField, string> = {
    name: t.errName,
    phases: t.errPhases,
    start: t.errStart,
  };
  const error = (f: MissionField) => (invalid(f) ? <FormError>{messages[f]}</FormError> : null);

  const gravityText = (g: number) =>
    g === 0
      ? t.gZero
      : g < 1
        ? format(t.gPartial, { pct: Math.round(g * 100) })
        : format(t.gHyper, { g: formatNumber(g, lang, 0) });
  const doseText = (d: number) =>
    d > 0
      ? format(t.doseXray, {
          n: Math.round(d / CHEST_XRAY_MSV),
          d: formatNumber(d, lang, d % 1 ? 1 : 0),
        })
      : t.doseNone;
  const commsText = (p: MissionPhase, e: EnvironmentOption) => {
    const wide = Math.abs(e.delayMax - e.delayMin) >= 1;
    if (wide && p.delayMin === undefined)
      return format(t.commsRange, {
        a: formatNumber(e.delayMin, lang, 0),
        b: formatNumber(e.delayMax, lang, 0),
      });
    const d = delayOf(p, e);
    if (!(d > 0)) return t.commsNow;
    if (d < 1) {
      const secs = d * 60;
      return format(t.commsSeconds, { s: formatNumber(secs, lang, secs < 10 ? 1 : 0) });
    }
    return format(t.commsMinutes, { m: formatNumber(d, lang, 0) });
  };

  const update = (i: number, patch: Partial<MissionPhase>) =>
    setPhases((list) =>
      list.map((p, k) => {
        if (k !== i) return p;
        if (patch.environment && patch.environment !== p.environment)
          return { environment: patch.environment, days: p.days };
        return { ...p, ...patch };
      }),
    );
  const move = (i: number, by: -1 | 1) => {
    setPhases((list) => {
      const next = [...list];
      const [item] = next.splice(i, 1);
      if (item) next.splice(i + by, 0, item);
      return next;
    });
    setOpen(i + by);
  };
  const add = () => {
    const at = phases.at(-1)?.environment === 'reentry' ? phases.length - 1 : phases.length;
    setPhases((list) => {
      const next = [...list];
      next.splice(at, 0, { environment: 'transit', days: 7 });
      return next;
    });
    setOpen(at);
  };

  const ranges = dayRanges(phases);
  const steps = [t.stepPlan, t.stepPhases, t.stepDetails];
  const end = new Date(`${startMode === 'date' ? start : today}T00:00:00Z`);
  end.setUTCDate(end.getUTCDate() + Math.max(0, total - 1));

  return (
    <form action={action} className="flex flex-1 flex-col gap-6">
      <input type="hidden" name="phases" value={JSON.stringify(phases)} />
      <input type="hidden" name="name" value={name} />
      <input type="hidden" name="start" value={startMode === 'date' ? start : today} />
      <input type="hidden" name="startMode" value={startMode} />

      <ol className="flex max-w-xl gap-2" aria-label={format(t.stepOf, { n: step })}>
        {steps.map((label, i) => {
          const n = i + 1;
          const done = step > n;
          return (
            <li
              key={label}
              aria-current={step === n ? 'step' : undefined}
              className={cn(
                'flex flex-1 items-center gap-2 text-xs',
                step === n ? 'text-foreground font-medium' : 'text-muted-foreground',
              )}
            >
              <span
                className={cn(
                  'grid size-5 shrink-0 place-items-center rounded-full border text-[10px] tabular-nums',
                  step === n && 'border-brand text-brand',
                  done && 'bg-brand border-brand text-white',
                )}
              >
                {done ? <Check aria-hidden="true" className="size-3" /> : n}
              </span>
              {label}
            </li>
          );
        })}
      </ol>

      {step === 1 ? (
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 flex flex-col gap-0.5">
              <span className="text-sm font-medium">{t.planTitle}</span>
              <span className="text-muted-foreground text-xs">{t.planHint}</span>
            </legend>
            {options.map((o) => {
              const selected = template === o.id;
              const days = o.phases.reduce((n, p) => n + p.days, 0);
              return (
                <button
                  key={o.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => {
                    setTemplate(o.id);
                    setPhases(o.phases.map((p) => ({ ...p })));
                    setOpen(0);
                  }}
                  className={cn(
                    'hover:bg-hover flex flex-col gap-1.5 rounded-lg border p-3 text-left transition-colors',
                    selected && 'border-brand bg-hover',
                  )}
                >
                  <span className="flex items-start justify-between gap-3">
                    <span className="text-sm font-medium">{o.name}</span>
                    {selected ? (
                      <Check aria-hidden="true" className="text-brand mt-0.5 size-4 shrink-0" />
                    ) : null}
                  </span>
                  <span className="text-muted-foreground text-xs">{o.description}</span>
                  <span className="text-tertiary text-2xs tabular-nums">
                    {format(t.daysTotal, { n: days })} ·{' '}
                    {format(t.phasesCount, { n: o.phases.length })}
                  </span>
                </button>
              );
            })}
          </fieldset>

          <article className="flex flex-col gap-5 rounded-xl border p-5 lg:sticky lg:top-16">
            <header className="flex flex-col gap-1.5">
              <h2 className="text-lg font-semibold">{chosen.name}</h2>
              {chosen.sourceUrl ? (
                <a
                  href={chosen.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-muted-foreground hover:text-foreground hover:bg-hover inline-flex w-fit items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs transition-colors"
                >
                  {format(t.basedOn, { source: chosen.basedOn })}
                  <ExternalLink aria-hidden="true" className="size-3" />
                  <span className="sr-only">{t.opensInNewTab}</span>
                </a>
              ) : (
                <span className="text-muted-foreground w-fit rounded-md border px-2 py-0.5 text-xs">
                  {format(t.basedOn, { source: chosen.basedOn })}
                </span>
              )}
            </header>
            <section className="flex flex-col gap-1.5">
              <h3 className="text-tertiary text-xs">{t.whatHappens}</h3>
              <p className="text-sm leading-6">{chosen.summary}</p>
            </section>
            <section className="flex flex-col gap-2">
              <h3 className="text-tertiary text-xs">
                {t.timelineTitle} ·{' '}
                {format(t.daysTotal, { n: chosen.phases.reduce((n, p) => n + p.days, 0) })}
              </h3>
              <PhaseBar
                phases={chosen.phases}
                names={chosen.phases.map(phaseName)}
                className="h-3"
              />
              <ol className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
                {chosen.phases.map((p, i) => {
                  const r = dayRanges(chosen.phases)[i] ?? { a: 1, b: 1 };
                  return (
                    // biome-ignore lint/suspicious/noArrayIndexKey: phases are positional
                    <li key={i} className="flex items-center gap-2 text-xs">
                      <span
                        aria-hidden="true"
                        className="size-2 shrink-0 rounded-full"
                        style={{ background: phaseColor(p.environment) }}
                      />
                      <span className="min-w-0 flex-1 truncate">{phaseName(p)}</span>
                      <span className="text-tertiary tabular-nums">
                        {r.a === r.b
                          ? format(t.dayOne, { a: r.a })
                          : format(t.dayRange, { a: r.a, b: r.b })}
                      </span>
                    </li>
                  );
                })}
              </ol>
            </section>
            <section className="flex flex-col gap-2">
              <h3 className="text-tertiary text-xs">{t.havenCares}</h3>
              <ul className="flex flex-col gap-2">
                {[...new Set(chosen.phases.map((p) => p.environment))].map((id) => {
                  const e = env(id);
                  if (!e?.watch.length) return null;
                  return (
                    <li key={id} className="flex gap-2.5 text-sm">
                      <span
                        aria-hidden="true"
                        className="mt-1.5 size-2 shrink-0 rounded-full"
                        style={{ background: phaseColor(id) }}
                      />
                      <span className="flex flex-col">
                        <span className="font-medium">{e.name}</span>
                        <span className="text-muted-foreground text-xs">{e.watch.join(' · ')}</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          </article>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="flex max-w-3xl flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h2 className="text-base font-semibold">{t.phasesTitle}</h2>
            <p className="text-muted-foreground text-sm">{t.phasesHint}</p>
          </div>
          <PhaseBar phases={phases} names={phases.map(phaseName)} current={open ?? undefined} />
          <p className="text-tertiary text-2xs tabular-nums">
            {format(t.daysTotal, { n: total })} · {format(t.phasesCount, { n: phases.length })}
          </p>

          <ol className="flex flex-col">
            {phases.map((p, i) => {
              const n = i + 1;
              const e = env(p.environment);
              const r = ranges[i] ?? { a: 1, b: 1 };
              const expanded = open === i;
              const last = i === phases.length - 1;
              return (
                // biome-ignore lint/suspicious/noArrayIndexKey: phases are positional
                <li key={i} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <span
                      aria-hidden="true"
                      className="grid size-6 shrink-0 place-items-center rounded-full text-[11px] font-medium text-white tabular-nums"
                      style={{ background: phaseColor(p.environment) }}
                    >
                      {n}
                    </span>
                    {last ? null : <span aria-hidden="true" className="bg-border w-px flex-1" />}
                  </div>
                  <div
                    className={cn(
                      'mb-3 min-w-0 flex-1 rounded-lg border',
                      expanded && 'bg-hover/40',
                    )}
                  >
                    <button
                      type="button"
                      aria-expanded={expanded}
                      onClick={() => setOpen(expanded ? null : i)}
                      className="hover:bg-hover flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors"
                    >
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="text-sm font-medium">{phaseName(p)}</span>
                        <span className="text-muted-foreground text-xs tabular-nums">
                          {r.a === r.b
                            ? format(t.dayOne, { a: r.a })
                            : format(t.dayRange, { a: r.a, b: r.b })}{' '}
                          · {p.days === 1 ? t.phaseLengthOne : format(t.phaseLength, { n: p.days })}
                          {p.label && e ? ` · ${e.name}` : ''}
                        </span>
                      </span>
                      <ChevronDown
                        aria-hidden="true"
                        className={cn(
                          'text-tertiary size-4 shrink-0 transition-transform',
                          expanded && 'rotate-180',
                        )}
                      />
                    </button>
                    {expanded && e ? (
                      <div className="flex flex-col gap-4 border-t px-3 pt-3 pb-3.5">
                        <p className="text-sm leading-6">{e.description}</p>
                        <dl className="grid gap-3 sm:grid-cols-2">
                          <Fact icon={<Orbit />} label={t.factGravity}>
                            {gravityText(e.gravity)}
                          </Fact>
                          <Fact icon={<Radiation />} label={t.factRadiation}>
                            {doseText(e.dailyDoseMSv)}
                          </Fact>
                          <Fact icon={<RadioTower />} label={t.factComms}>
                            {commsText(p, e)}
                          </Fact>
                          <Fact icon={<Home />} label={t.factReturn}>
                            {e.evacuation ? t.returnYes : t.returnNo}
                          </Fact>
                        </dl>
                        {e.watch.length ? (
                          <div className="flex flex-col gap-1">
                            <span className="text-tertiary text-xs">{t.watchTitle}</span>
                            <ul className="flex list-disc flex-col gap-0.5 pl-4 text-sm">
                              {e.watch.map((w) => (
                                <li key={w}>{w}</li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                        <div className="flex flex-col gap-1.5 border-t pt-3">
                          <span className="text-tertiary text-xs">{t.editPhase}</span>
                          <div className="flex flex-wrap items-center gap-2">
                            <Select
                              items={environments.map((x) => ({ value: x.id, label: x.name }))}
                              value={p.environment}
                              onValueChange={(v) =>
                                typeof v === 'string' && update(i, { environment: v })
                              }
                            >
                              <SelectTrigger
                                aria-label={format(t.phaseEnvironment, { n })}
                                className="h-8 min-w-48 flex-1"
                              >
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {environments.map((x) => (
                                  <SelectItem key={x.id} value={x.id}>
                                    {x.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Input
                              type="number"
                              min={1}
                              step={1}
                              aria-label={`${t.phaseDays} · ${format(t.phaseEnvironment, { n })}`}
                              className={cn('numeric h-8 w-20', INVALID_INPUT)}
                              aria-invalid={p.days < 1 || undefined}
                              value={String(p.days)}
                              onChange={(ev) =>
                                update(i, {
                                  days: Math.max(0, Math.floor(Number(ev.target.value) || 0)),
                                })
                              }
                            />
                            <span className="text-muted-foreground text-xs">{t.phaseDays}</span>
                            <div className="ml-auto flex">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                aria-label={format(t.moveUp, { n })}
                                disabled={i === 0}
                                onClick={() => move(i, -1)}
                              >
                                <ArrowUp />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                aria-label={format(t.moveDown, { n })}
                                disabled={last}
                                onClick={() => move(i, 1)}
                              >
                                <ArrowDown />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                aria-label={format(t.removePhase, { n })}
                                disabled={phases.length <= 1}
                                onClick={() => {
                                  setPhases((list) => list.filter((_, k) => k !== i));
                                  setOpen(null);
                                }}
                              >
                                <X />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ol>
          <Button type="button" variant="outline" size="sm" className="ml-9 w-fit" onClick={add}>
            <Plus data-icon="inline-start" />
            {t.addPhase}
          </Button>
          {error('phases')}
        </div>
      ) : null}

      {step === 3 ? (
        <div className="grid max-w-3xl items-start gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="mission-name">{t.missionName}</FieldLabel>
              <Input
                id="mission-name"
                required
                maxLength={80}
                placeholder={t.missionNamePlaceholder}
                className={cn('h-9', INVALID_INPUT)}
                value={name}
                onChange={(e) => setName(e.target.value)}
                aria-invalid={invalid('name') || undefined}
              />
              {error('name')}
            </Field>
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-2 text-sm font-medium">{t.startWhen}</legend>
              {START_MODES.map((mode) => {
                const label = { manual: t.startManual, now: t.startNow, date: t.startDate }[mode];
                const hint = {
                  manual: t.startManualHint,
                  now: t.startNowHint,
                  date: t.startDateHint,
                }[mode];
                return (
                  <label
                    key={mode}
                    className={cn(
                      'hover:bg-hover flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors',
                      startMode === mode && 'border-brand bg-hover',
                    )}
                  >
                    <input
                      type="radio"
                      name="start-mode-choice"
                      value={mode}
                      checked={startMode === mode}
                      onChange={() => setStartMode(mode)}
                      className="accent-brand mt-1"
                    />
                    <span className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="text-sm font-medium">{label}</span>
                      <span className="text-muted-foreground text-xs leading-5">{hint}</span>
                      {mode === 'date' && startMode === 'date' ? (
                        <Input
                          id="mission-start"
                          type="date"
                          required
                          aria-label={t.start}
                          className={cn('numeric mt-1 h-9 sm:max-w-56', INVALID_INPUT)}
                          aria-invalid={invalid('start') || undefined}
                          value={start}
                          onChange={(e) => setStart(e.target.value)}
                        />
                      ) : null}
                    </span>
                  </label>
                );
              })}
              {error('start')}
            </fieldset>
          </FieldGroup>
          <aside className="flex flex-col gap-3 rounded-xl border p-4">
            <span className="text-tertiary text-xs">{t.summaryTitle}</span>
            <span className={cn('text-sm font-medium', !name.trim() && 'text-muted-foreground')}>
              {name.trim() || t.missionNamePlaceholder}
            </span>
            {template === 'current' ? null : (
              <span className="text-muted-foreground text-xs">{chosen.name}</span>
            )}
            <PhaseBar phases={phases} names={phases.map(phaseName)} />
            <span className="text-muted-foreground text-xs tabular-nums">
              {format(t.daysTotal, { n: total })} · {format(t.phasesCount, { n: phases.length })}
              {startMode === 'manual'
                ? ` · ${format(t.lastsFromStart, { n: total })}`
                : Number.isNaN(end.getTime())
                  ? ''
                  : ` · ${format(t.endsOn, { date: formatDate(end.toISOString(), lang) })}`}
            </span>
          </aside>
        </div>
      ) : null}

      <div className="bg-background/90 sticky bottom-0 z-10 -mx-4 mt-auto -mb-5 flex items-center gap-3 border-t px-4 py-3 backdrop-blur-md sm:-mx-6 sm:-mb-6 sm:px-6">
        {step > 1 ? (
          <Button
            key="back"
            type="button"
            variant="outline"
            onClick={() => setStep((s) => (s === 3 ? 2 : 1))}
          >
            {t.back}
          </Button>
        ) : (
          <Link href={cancelHref} className={buttonVariants({ variant: 'ghost' })}>
            {t.cancel}
          </Link>
        )}
        {state.status === 'error' && state.message ? <FormError>{t.errSavePlan}</FormError> : null}
        <span className="text-muted-foreground ml-auto hidden text-right text-xs leading-4 sm:block">
          {format(t.stepOf, { n: step })}
          {step < 3 ? (
            <span className="text-tertiary block">
              {format(t.nextStep, { step: steps[step] ?? '' })}
            </span>
          ) : null}
        </span>
        {step < 3 ? (
          <Button
            key="next"
            type="button"
            className="max-sm:ml-auto"
            disabled={step === 2 && !phasesValid}
            onClick={() => setStep((s) => (s === 1 ? 2 : 3))}
          >
            {t.next}
          </Button>
        ) : (
          <Button
            key="submit"
            type="submit"
            className="max-sm:ml-auto"
            disabled={pending || !phasesValid}
          >
            <Check data-icon="inline-start" />
            {pending ? t.savingPlan : t.savePlan}
          </Button>
        )}
      </div>
    </form>
  );
}

function Fact({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="flex gap-2.5">
      <span aria-hidden="true" className="text-tertiary mt-0.5 [&_svg]:size-4">
        {icon}
      </span>
      <div className="flex flex-col">
        <dt className="text-tertiary text-xs">{label}</dt>
        <dd className="text-sm">{children}</dd>
      </div>
    </div>
  );
}
