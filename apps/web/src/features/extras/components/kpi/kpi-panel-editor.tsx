'use client';

import { Plus, Trash2, X } from 'lucide-react';
import { useId, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { format } from '@/lib/i18n';
import {
  KPI_LIMITS,
  KPI_PANEL_TYPES,
  KPI_RANGES,
  type KpiPanel,
  type KpiPanelType,
  type KpiRange,
  type KpiSeries,
} from '@/lib/kpi';
import {
  compatibleIndicators,
  defaultTitle,
  fitSeries,
  isChart,
  isSingleSeries,
  type KpiIndicatorInfo,
  nextSeries,
  retypePanel,
  showsReference,
} from '../../logic/kpi';
import type { KpiEnv } from './model';
import { PANEL_ICONS } from './panel-types';
import { rangeLong, typeName } from './texts';

const INHERIT = 'inherit';

function IndicatorSelect({
  value,
  options,
  all,
  label,
  onChange,
}: {
  value: string;
  options: KpiIndicatorInfo[];
  all: KpiIndicatorInfo[];
  label: string;
  onChange: (id: string) => void;
}) {
  const items = all.map((i) => ({ value: i.id, label: i.name }));
  if (!items.some((i) => i.value === value)) items.push({ value, label: value });
  const zones = [...new Set(options.map((o) => o.zone))];
  return (
    <Select
      items={items}
      value={value}
      onValueChange={(v) => {
        if (typeof v === 'string') onChange(v);
      }}
    >
      <SelectTrigger aria-label={label} size="sm" className="w-full min-w-0">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {zones.map((zone) => {
          const inZone = options.filter((o) => o.zone === zone);
          return (
            <SelectGroup key={zone}>
              <SelectLabel>{inZone[0]?.zoneName ?? zone}</SelectLabel>
              {inZone.map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  {o.name}
                  <span className="text-tertiary self-center text-xs">{o.unit}</span>
                </SelectItem>
              ))}
            </SelectGroup>
          );
        })}
      </SelectContent>
    </Select>
  );
}

function ToggleRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex flex-col gap-0.5">
        <span id={`${id}-label`} className="text-sm font-medium">
          {label}
        </span>
        <span id={`${id}-hint`} className="text-muted-foreground text-xs">
          {hint}
        </span>
      </div>
      <Switch
        checked={checked}
        onCheckedChange={(v) => onChange(v)}
        aria-labelledby={`${id}-label`}
        aria-describedby={`${id}-hint`}
        className="mt-0.5"
      />
    </div>
  );
}

export function KpiPanelEditor({
  panel,
  env,
  withData,
  onChange,
  onDelete,
  onClose,
}: {
  panel: KpiPanel | null;
  env: KpiEnv;
  withData: Set<string>;
  onChange: (panel: KpiPanel) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  const { t } = env;
  const id = useId();
  // Keep showing the last panel while the sheet animates out.
  const last = useRef(panel);
  if (panel) last.current = panel;
  const shown = panel ?? last.current;
  return (
    <Sheet
      // The page stays scrollable (and undimmed) so the panel's live preview can be followed.
      modal="trap-focus"
      open={panel !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent side="right" dimmed={false} className="gap-0 data-[side=right]:sm:max-w-xl">
        {shown ? (
          <EditorBody
            id={id}
            panel={shown}
            env={env}
            withData={withData}
            onChange={onChange}
            onDelete={() => onDelete(shown.id)}
            onClose={onClose}
          />
        ) : (
          <SheetHeader>
            <SheetTitle>{t.kpiEditorTitle}</SheetTitle>
          </SheetHeader>
        )}
      </SheetContent>
    </Sheet>
  );
}

function EditorBody({
  id,
  panel,
  env,
  withData,
  onChange,
  onDelete,
  onClose,
}: {
  id: string;
  panel: KpiPanel;
  env: KpiEnv;
  withData: Set<string>;
  onChange: (panel: KpiPanel) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const { t, indicators } = env;
  const chart = isChart(panel.type);
  const single = isSingleSeries(panel.type);
  const placeholder = defaultTitle(panel, env.byId, env.sources, typeName(t, panel.type));
  const firstUnit = env.byId.get(panel.series[0]?.indicator ?? '')?.unit;
  const sourceItems = [...env.sources.values()].map((s) => ({ value: s.id, label: s.name }));
  const periodItems = [
    { value: INHERIT, label: t.kpiPeriodInherit },
    ...KPI_RANGES.map((r) => ({ value: r, label: rangeLong(t, r) })),
  ];

  const setSeries = (series: KpiSeries[]) =>
    onChange({ ...panel, series: fitSeries(panel.type, series, indicators) });
  const patchSeries = (index: number, patch: Partial<KpiSeries>) =>
    setSeries(panel.series.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  const added = nextSeries(panel, indicators, withData, [...env.sources.keys()]);

  return (
    <>
      <SheetHeader className="border-b">
        <SheetTitle>{t.kpiEditorTitle}</SheetTitle>
        <SheetDescription className="text-xs">{t.kpiEditorDescription}</SheetDescription>
      </SheetHeader>
      <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto p-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${id}-title`}>{t.kpiFieldTitle}</Label>
          <Input
            id={`${id}-title`}
            value={panel.title ?? ''}
            maxLength={KPI_LIMITS.title}
            placeholder={placeholder}
            onChange={(e) => {
              const title = e.target.value.slice(0, KPI_LIMITS.title);
              const { title: _old, ...rest } = panel;
              onChange(title ? { ...rest, title } : rest);
            }}
          />
        </div>

        <div className="flex flex-col gap-2">
          <span id={`${id}-type`} className="text-sm font-medium">
            {t.kpiFieldType}
          </span>
          <ToggleGroup
            aria-labelledby={`${id}-type`}
            value={[panel.type]}
            onValueChange={(v) => {
              const next = v[0] as KpiPanelType | undefined;
              if (next && next !== panel.type) onChange(retypePanel(panel, next, indicators));
            }}
            variant="outline"
            spacing={0}
            className="grid w-full grid-cols-5"
          >
            {KPI_PANEL_TYPES.map((type) => {
              const Icon = PANEL_ICONS[type];
              return (
                <ToggleGroupItem
                  key={type}
                  value={type}
                  className="text-2xs data-pressed:bg-active data-pressed:text-foreground text-muted-foreground h-14 min-w-0 flex-col gap-1 px-1"
                >
                  <Icon aria-hidden="true" />
                  <span className="max-w-full truncate">{typeName(t, type)}</span>
                </ToggleGroupItem>
              );
            })}
          </ToggleGroup>
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-medium">{t.kpiFieldSeries}</legend>
          <ol className="flex flex-col gap-2">
            {panel.series.map((s, index) => {
              const options =
                index === 0
                  ? indicators
                  : compatibleIndicators(panel.type, panel.series, indicators);
              return (
                <li
                  // biome-ignore lint/suspicious/noArrayIndexKey: rows are positional; the same series may repeat
                  key={index}
                  className="bg-muted/40 flex items-start gap-2 rounded-lg border p-2"
                >
                  <div className="grid min-w-0 flex-1 grid-cols-1 gap-2 sm:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
                    <IndicatorSelect
                      value={s.indicator}
                      options={options}
                      all={indicators}
                      label={format(t.kpiFieldIndicator, { n: index + 1 })}
                      onChange={(indicator) => patchSeries(index, { indicator })}
                    />
                    <Select
                      items={
                        sourceItems.some((i) => i.value === s.source)
                          ? sourceItems
                          : [...sourceItems, { value: s.source, label: s.source }]
                      }
                      value={s.source}
                      onValueChange={(v) => {
                        if (typeof v === 'string') patchSeries(index, { source: v });
                      }}
                    >
                      <SelectTrigger
                        aria-label={format(t.kpiFieldSource, { n: index + 1 })}
                        size="sm"
                        className="w-full min-w-0"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {sourceItems.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {panel.series.length > 1 ? (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={format(t.kpiRemoveSeries, { n: index + 1 })}
                      onClick={() => setSeries(panel.series.filter((_, i) => i !== index))}
                    >
                      <X />
                    </Button>
                  ) : null}
                </li>
              );
            })}
          </ol>
          {single ? (
            <p className="text-muted-foreground text-xs">{t.kpiSingleSeriesHint}</p>
          ) : (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <Button
                variant="outline"
                size="sm"
                disabled={panel.series.length >= KPI_LIMITS.series || !added}
                onClick={() => {
                  if (added) setSeries([...panel.series, added]);
                }}
              >
                <Plus data-icon="inline-start" />
                {t.kpiAddSeries}
              </Button>
              <span className="text-tertiary text-xs">
                {format(t.kpiSeriesLimit, { n: KPI_LIMITS.series })}
              </span>
            </div>
          )}
          {chart && firstUnit ? (
            <p className="text-muted-foreground text-xs">
              {format(t.kpiSameUnitHint, { unit: firstUnit })}
            </p>
          ) : null}
        </fieldset>

        <div className="flex flex-col gap-2">
          <span id={`${id}-period`} className="text-sm font-medium">
            {t.kpiFieldPeriod}
          </span>
          <Select
            items={periodItems}
            value={panel.range ?? INHERIT}
            onValueChange={(v) => {
              if (typeof v !== 'string') return;
              const { range: _old, ...rest } = panel;
              onChange(v === INHERIT ? rest : { ...rest, range: v as KpiRange });
            }}
          >
            <SelectTrigger aria-labelledby={`${id}-period`} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {periodItems.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-4">
          <ToggleRow
            label={t.kpiFieldReference}
            hint={t.kpiFieldReferenceHint}
            checked={showsReference(panel)}
            onChange={(reference) => onChange({ ...panel, reference })}
          />
          {panel.type === 'timeseries' ? (
            <ToggleRow
              label={t.kpiFieldMarkers}
              hint={t.kpiFieldMarkersHint}
              checked={panel.markers === true}
              onChange={(markers) => onChange({ ...panel, markers })}
            />
          ) : null}
        </div>
      </div>
      <SheetFooter className="flex-row justify-between border-t">
        <Button
          variant="ghost"
          className="text-destructive hover:text-destructive"
          onClick={onDelete}
        >
          <Trash2 data-icon="inline-start" />
          {t.kpiDeletePanel}
        </Button>
        <Button onClick={onClose}>{t.kpiDone}</Button>
      </SheetFooter>
    </>
  );
}
