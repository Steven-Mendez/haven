'use client';

import { NumberField } from '@base-ui/react/number-field';
import { Slider } from '@base-ui/react/slider';
import { Minus, Plus } from 'lucide-react';
import { useState } from 'react';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { cn } from '@/lib/utils';
import { type RangeControl, sliderDomain } from '../logic/range-control';
import type { Range } from '../logic/rules';

const parse = (s: string | undefined) => {
  const n = Number(String(s ?? '').replace(',', '.'));
  return s !== undefined && s.trim() !== '' && Number.isFinite(n) ? n : undefined;
};

type Props = {
  prefix: string;
  control: RangeControl;
  values: Record<string, string>;
  onChange: (name: string, value: string) => void;
  labels: { min: string; max: string };
  unit: string;
  invalid?: boolean;
  /** Color del tramo seleccionado en el deslizador. */
  tone?: 'green' | 'amber' | 'red';
};

export function ThresholdRangeInput({
  prefix,
  control,
  values,
  onChange,
  labels,
  unit,
  invalid,
  tone = 'green',
}: Props) {
  const minName = `${prefix}-min`;
  const maxName = `${prefix}-max`;
  const min = parse(values[minName]);
  const max = parse(values[maxName]);
  // El recorrido se fija con los valores iniciales: así no se reescala mientras se arrastra.
  const [domain] = useState<Range | undefined>(() =>
    control.kind === 'continuous' && min !== undefined && max !== undefined
      ? sliderDomain([min, max], control)
      : undefined,
  );
  const hidden = (
    <>
      <input type="hidden" name={minName} value={values[minName] ?? ''} />
      <input type="hidden" name={maxName} value={values[maxName] ?? ''} />
    </>
  );

  if (control.kind === 'discrete') {
    const picker = (name: string, label: string, current: number | undefined) => (
      <div className="flex flex-col gap-1.5">
        <span id={`${name}-label`} className="text-muted-foreground text-xs">
          {label}
          {unit ? ` · ${unit}` : ''}
        </span>
        <ToggleGroup
          aria-labelledby={`${name}-label`}
          variant="outline"
          size="sm"
          spacing={0}
          value={current === undefined ? [] : [String(current)]}
          onValueChange={(v) => {
            const next = v.at(-1);
            if (next !== undefined) onChange(name, String(next));
          }}
          className={cn('w-fit', invalid && 'ring-destructive/40 rounded-md ring-2')}
        >
          {control.options.map((o) => (
            <ToggleGroupItem key={o} value={String(o)} className="min-w-9 tabular-nums">
              {o}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
    );
    return (
      <div className="flex flex-wrap gap-x-8 gap-y-3">
        {hidden}
        {picker(minName, labels.min, min)}
        {picker(maxName, labels.max, max)}
      </div>
    );
  }

  const [dMin, dMax] = domain ?? [min ?? 0, max ?? 1];
  // El dominio se estira si alguien escribe un valor fuera de él.
  const lo = Math.min(dMin, min ?? dMin, max ?? dMin);
  const hi = Math.max(dMax, min ?? dMax, max ?? dMax);
  const fmt = (n: number) => n.toFixed(control.decimals);
  const sliderValue: Range = [min ?? lo, max ?? hi];

  const stepper = (name: string, label: string, current: number | undefined) => (
    <NumberField.Root
      value={current ?? null}
      onValueChange={(v) => onChange(name, v === null ? '' : fmt(v))}
      step={control.step}
      largeStep={control.step * 10}
      format={{
        maximumFractionDigits: control.decimals,
        minimumFractionDigits: control.decimals,
        useGrouping: false,
      }}
      locale="en-US"
      className="flex flex-col gap-1.5"
    >
      <label htmlFor={name} className="text-muted-foreground text-xs">
        {label}
        {unit ? ` · ${unit}` : ''}
      </label>
      <NumberField.Group
        className={cn(
          'border-input focus-within:border-ring focus-within:ring-ring/50 flex h-9 items-center rounded-md border focus-within:ring-[3px]',
          invalid && 'border-destructive ring-destructive/20',
        )}
      >
        <NumberField.Decrement
          aria-label={`− ${label}`}
          className="text-muted-foreground hover:text-foreground hover:bg-hover flex h-full w-9 items-center justify-center rounded-l-md"
        >
          <Minus className="size-3.5" />
        </NumberField.Decrement>
        <NumberField.Input
          id={name}
          aria-invalid={invalid || undefined}
          className="h-full w-full min-w-0 bg-transparent text-center text-sm tabular-nums outline-none"
        />
        <NumberField.Increment
          aria-label={`+ ${label}`}
          className="text-muted-foreground hover:text-foreground hover:bg-hover flex h-full w-9 items-center justify-center rounded-r-md"
        >
          <Plus className="size-3.5" />
        </NumberField.Increment>
      </NumberField.Group>
    </NumberField.Root>
  );

  return (
    <div className="flex flex-col gap-3">
      {hidden}
      <Slider.Root
        value={sliderValue}
        min={lo}
        max={hi}
        step={control.step}
        largeStep={control.step * 10}
        onValueChange={(v) => {
          const [a, b] = v as number[];
          if (a !== undefined && a !== min) onChange(minName, fmt(a));
          if (b !== undefined && b !== max) onChange(maxName, fmt(b));
        }}
        className="px-2 pt-1"
      >
        <Slider.Control className="flex h-6 w-full touch-none items-center select-none">
          <Slider.Track className="bg-muted relative h-1.5 w-full rounded-full">
            <Slider.Indicator
              className="absolute h-full rounded-full"
              style={{ background: `var(--scale-${tone})` }}
            />
            {[labels.min, labels.max].map((label, index) => (
              <Slider.Thumb
                key={label}
                index={index}
                aria-label={label}
                className="bg-background border-foreground/60 focus-visible:ring-ring/50 size-4 rounded-full border-2 shadow-sm outline-none focus-visible:ring-[3px]"
              />
            ))}
          </Slider.Track>
        </Slider.Control>
        <div
          aria-hidden="true"
          className="text-muted-foreground text-2xs mt-1 flex justify-between tabular-nums"
        >
          <span>{fmt(lo)}</span>
          <span>{fmt(hi)}</span>
        </div>
      </Slider.Root>
      <div className="grid grid-cols-2 gap-3">
        {stepper(minName, labels.min, min)}
        {stepper(maxName, labels.max, max)}
      </div>
    </div>
  );
}
