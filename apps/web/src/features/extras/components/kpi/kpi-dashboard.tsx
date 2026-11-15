'use client';

import { LayoutDashboard, Pencil, Plus, RotateCcw } from 'lucide-react';
import { useMemo, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { EmptyState } from '@/components/haven/empty-state';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { format, type Language } from '@/lib/i18n';
import {
  KPI_LIMITS,
  KPI_PANEL_TYPES,
  KPI_RANGES,
  type KpiDashboard as KpiDashboardData,
  type KpiPanelType,
  type KpiRange,
  type KpiSeriesData,
} from '@/lib/kpi';
import { saveKpiDashboard } from '../../actions';
import {
  addPanel,
  dataEnd,
  duplicatePanel,
  inWindow,
  type KpiIndicatorInfo,
  type KpiMarker,
  type KpiSource,
  newPanel,
  panelId,
  removePanel,
  sameDashboard,
  seriesPoints,
  updatePanel,
  windowFor,
} from '../../logic/kpi';
import { ExportCsvButton } from '../export-buttons';
import { KpiGrid } from './kpi-grid';
import { KpiPanel } from './kpi-panel';
import { KpiPanelEditor } from './kpi-panel-editor';
import type { KpiEnv } from './model';
import { PANEL_ICONS } from './panel-types';
import { type KpiTexts, rangeLabel, rangeLong, typeDetail, typeName } from './texts';

export type KpiDashboardProps = {
  mission: string;
  lang: Language;
  indicators: KpiIndicatorInfo[];
  sources: KpiSource[];
  series: KpiSeriesData;
  markers: KpiMarker[];
  initial: KpiDashboardData | null;
  fallback: KpiDashboardData;
  texts: KpiTexts;
};

function newId(): string {
  const uuid =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return panelId(uuid);
}

function AddPanelMenu({
  t,
  disabled,
  onAdd,
  variant = 'outline',
}: {
  t: KpiTexts;
  disabled: boolean;
  onAdd: (type: KpiPanelType) => void;
  variant?: 'outline' | 'default';
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={disabled}
        render={
          <Button
            variant={variant}
            size="sm"
            title={disabled ? format(t.kpiPanelLimit, { n: KPI_LIMITS.panels }) : undefined}
          />
        }
      >
        <Plus data-icon="inline-start" />
        {t.kpiAddPanel}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        {KPI_PANEL_TYPES.map((type) => {
          const Icon = PANEL_ICONS[type];
          return (
            <DropdownMenuItem key={type} onClick={() => onAdd(type)} className="items-start py-1.5">
              <Icon aria-hidden="true" className="text-muted-foreground mt-0.5" />
              <span className="flex min-w-0 flex-col">
                <span className="text-sm">{typeName(t, type)}</span>
                <span className="text-muted-foreground text-xs">{typeDetail(t, type)}</span>
              </span>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function KpiDashboard({
  mission,
  lang,
  indicators,
  sources,
  series,
  markers,
  initial,
  fallback,
  texts: t,
}: KpiDashboardProps) {
  const [saved, setSaved] = useState<KpiDashboardData>(initial ?? fallback);
  const [draft, setDraft] = useState<KpiDashboardData>(saved);
  const [editing, setEditing] = useState(false);
  const [range, setRange] = useState<KpiRange>(saved.range);
  const [editingPanelId, setEditingPanelId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const dashboard = editing ? draft : saved;
  const dirty = editing && !sameDashboard(draft, saved);
  const byId = useMemo(() => new Map(indicators.map((i) => [i.id, i])), [indicators]);
  const sourceMap = useMemo(() => new Map(sources.map((s) => [s.id, s])), [sources]);
  const withData = useMemo(
    () => new Set(indicators.filter((i) => series.crew[i.id]?.length).map((i) => i.id)),
    [indicators, series],
  );
  const end = useMemo(() => dataEnd(series, dashboard), [series, dashboard]);
  const env: KpiEnv = {
    lang,
    t,
    indicators,
    byId,
    sources: sourceMap,
    data: series,
    markers,
    end,
    range,
  };

  const startEditing = () => {
    setDraft(saved);
    setEditing(true);
  };
  const discard = () => {
    setDraft(saved);
    setRange(saved.range);
    setEditing(false);
    setEditingPanelId(null);
  };
  const reset = () => {
    setDraft(fallback);
    setRange(fallback.range);
    setEditingPanelId(null);
  };
  const add = (type: KpiPanelType) => {
    const base = editing ? draft : saved;
    if (base.panels.length >= KPI_LIMITS.panels) return;
    const panel = newPanel(type, newId(), indicators, withData);
    setDraft(addPanel(base, panel));
    setEditing(true);
    setEditingPanelId(panel.id);
  };
  const save = () => {
    const next = draft;
    startTransition(async () => {
      try {
        const result = await saveKpiDashboard(next);
        if (result.ok) {
          setSaved(next);
          setEditing(false);
          setEditingPanelId(null);
          toast.success(t.kpiSaved);
        } else {
          toast.error(t.kpiSaveFailed);
        }
      } catch {
        toast.error(t.kpiSaveFailed);
      }
    });
  };

  const rows = (() => {
    const win = windowFor(range, end);
    const seen = new Set<string>();
    const out: (string | number)[][] = [];
    for (const p of dashboard.panels) {
      for (const s of p.series) {
        const key = `${s.indicator}|${s.source}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const unit = byId.get(s.indicator)?.unitId ?? '';
        for (const point of inWindow(seriesPoints(series, s), win))
          out.push([point.date, s.source, s.indicator, unit, point.mean]);
      }
    }
    return out.sort((a, b) => String(a[0]).localeCompare(String(b[0])));
  })();

  const editingPanel = editing ? (draft.panels.find((p) => p.id === editingPanelId) ?? null) : null;
  const atLimit = draft.panels.length >= KPI_LIMITS.panels;

  return (
    <div data-testid="kpi-dashboard" className="flex flex-col gap-3">
      <div
        role="toolbar"
        aria-label={t.kpiToolbar}
        className="flex flex-wrap items-center justify-between gap-2"
      >
        <ToggleGroup
          value={[range]}
          onValueChange={(v) => {
            const next = v[0] as KpiRange | undefined;
            if (!next) return;
            setRange(next);
            if (editing) setDraft((d) => ({ ...d, range: next }));
          }}
          spacing={0}
          aria-label={t.kpiPeriod}
          className="h-8 rounded-lg border p-0.5"
        >
          {KPI_RANGES.map((r) => (
            <ToggleGroupItem
              key={r}
              value={r}
              size="sm"
              aria-label={rangeLong(t, r)}
              className="text-muted-foreground data-pressed:bg-active data-pressed:text-foreground h-7 min-w-10 rounded-md! px-2.5 text-xs tabular-nums"
            >
              {rangeLabel(t, r)}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <div className="flex flex-wrap items-center gap-2">
          {editing ? (
            <>
              <AddPanelMenu t={t} disabled={atLimit} onAdd={add} />
              <Button variant="ghost" size="sm" onClick={reset} title={t.kpiResetHint}>
                <RotateCcw data-icon="inline-start" />
                {t.kpiReset}
              </Button>
              <Button variant="ghost" size="sm" onClick={discard} disabled={pending}>
                {t.kpiDiscard}
              </Button>
              <Button size="sm" onClick={save} disabled={pending || !dirty}>
                {pending ? t.kpiSaving : t.kpiSave}
              </Button>
            </>
          ) : (
            <>
              <ExportCsvButton
                filename={`haven-kpi-${mission}-${range}.csv`}
                header={['date', 'source', 'indicator', 'unit', 'value']}
                rows={rows}
                label={t.exportCsv}
              />
              <Button variant="outline" size="sm" onClick={startEditing}>
                <Pencil data-icon="inline-start" />
                {t.kpiEdit}
              </Button>
            </>
          )}
        </div>
      </div>

      {dashboard.panels.length === 0 ? (
        <div data-testid="kpi-dashboard-empty">
          <EmptyState
            icon={<LayoutDashboard />}
            title={t.kpiEmptyTitle}
            description={t.kpiEmptyDetail}
            action={
              editing ? (
                <AddPanelMenu t={t} disabled={atLimit} onAdd={add} variant="default" />
              ) : (
                <Button size="sm" onClick={startEditing}>
                  <Plus data-icon="inline-start" />
                  {t.kpiAddFirst}
                </Button>
              )
            }
          />
        </div>
      ) : (
        <KpiGrid
          dashboard={dashboard}
          editing={editing}
          hint={{ grid: t.kpiEditHint, stacked: t.kpiEditHintStacked }}
          onLayoutChange={(layout) => setDraft((d) => ({ ...d, layout }))}
          renderPanel={(id, { draggable }) => {
            const panel = dashboard.panels.find((p) => p.id === id);
            if (!panel) return null;
            return (
              <KpiPanel
                panel={panel}
                env={env}
                editing={editing}
                draggable={draggable}
                selected={editingPanel?.id === id}
                onEdit={() => setEditingPanelId(id)}
                onDuplicate={() =>
                  setDraft((d) =>
                    d.panels.length >= KPI_LIMITS.panels ? d : duplicatePanel(d, id, newId()),
                  )
                }
                onDelete={() => {
                  setDraft((d) => removePanel(d, id));
                  if (editingPanelId === id) setEditingPanelId(null);
                }}
              />
            );
          }}
        />
      )}

      <KpiPanelEditor
        panel={editingPanel}
        env={env}
        withData={withData}
        onChange={(panel) => setDraft((d) => updatePanel(d, panel))}
        onDelete={(id) => {
          setDraft((d) => removePanel(d, id));
          setEditingPanelId(null);
        }}
        onClose={() => setEditingPanelId(null)}
      />
    </div>
  );
}
