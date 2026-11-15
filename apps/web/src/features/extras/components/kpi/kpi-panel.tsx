'use client';

import { Copy, Ellipsis, GripVertical, Pencil, SquareArrowOutUpRight, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { format } from '@/lib/i18n';
import type { KpiPanel as KpiPanelData } from '@/lib/kpi';
import { cn } from '@/lib/utils';
import { KpiChart } from './kpi-chart';
import { KpiGauge } from './kpi-gauge';
import { KpiStat } from './kpi-stat';
import { NoData } from './kpi-status';
import { KpiTable } from './kpi-table';
import { type KpiEnv, type ResolvedPanel, resolvePanel } from './model';
import { rangeLong } from './texts';

export const DRAG_HANDLE = 'kpi-drag-handle';
export const NO_DRAG = 'kpi-no-drag';

function Body({ model, env }: { model: ResolvedPanel; env: KpiEnv }) {
  if (!model.hasData) return <NoData t={env.t} />;
  switch (model.panel.type) {
    case 'timeseries':
    case 'bars':
      return <KpiChart model={model} env={env} />;
    case 'stat':
      return <KpiStat model={model} env={env} />;
    case 'gauge':
      return <KpiGauge model={model} env={env} />;
    case 'table':
      return <KpiTable model={model} env={env} />;
  }
}

export function KpiPanel({
  panel,
  env,
  editing,
  draggable,
  selected = false,
  onEdit,
  onDuplicate,
  onDelete,
}: {
  panel: KpiPanelData;
  env: KpiEnv;
  editing: boolean;
  draggable: boolean;
  /** The panel open in the editor: outlined so its live preview is easy to follow. */
  selected?: boolean;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const { t } = env;
  const model = resolvePanel(panel, env);
  const indicator = model.indicator?.id;
  const hasMenu = editing || indicator !== undefined;
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!selected) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    ref.current?.scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' });
  }, [selected]);
  return (
    <section
      ref={ref}
      aria-label={model.title}
      data-testid="kpi-panel"
      data-panel-type={panel.type}
      className={cn(
        'bg-card flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border transition-shadow',
        selected && 'border-ring ring-ring/40 ring-2',
      )}
    >
      <header
        title={draggable ? format(t.kpiDragHandle, { title: model.title }) : undefined}
        className={cn(
          'flex h-9 shrink-0 items-center gap-1.5 pr-1.5 pl-3',
          draggable && `${DRAG_HANDLE} cursor-grab select-none active:cursor-grabbing`,
        )}
      >
        {draggable ? (
          <GripVertical aria-hidden="true" className="text-tertiary -ml-1.5 size-3.5 shrink-0" />
        ) : null}
        <div className="flex min-w-0 flex-1 items-baseline gap-2">
          <h3 className="truncate text-xs font-medium">{model.title}</h3>
          {model.ownRange ? (
            <span className="text-tertiary text-2xs shrink-0">{rangeLong(t, model.range)}</span>
          ) : null}
        </div>
        {hasMenu ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label={format(t.kpiPanelMenu, { title: model.title })}
                  className={cn(NO_DRAG, 'cursor-default')}
                />
              }
            >
              <Ellipsis />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-auto min-w-44">
              {editing ? (
                <>
                  <DropdownMenuItem onClick={onEdit}>
                    <Pencil aria-hidden="true" />
                    {t.kpiPanelEdit}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={onDuplicate}>
                    <Copy aria-hidden="true" />
                    {t.kpiPanelDuplicate}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onClick={onDelete}>
                    <Trash2 aria-hidden="true" />
                    {t.kpiPanelDelete}
                  </DropdownMenuItem>
                </>
              ) : indicator ? (
                <DropdownMenuItem
                  render={
                    <Link
                      href={`/kpi?view=individual&indicator=${encodeURIComponent(indicator)}`}
                    />
                  }
                >
                  <SquareArrowOutUpRight aria-hidden="true" />
                  {t.kpiOpenIndividual}
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </header>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col px-3 pb-3">
        <Body model={model} env={env} />
      </div>
    </section>
  );
}
