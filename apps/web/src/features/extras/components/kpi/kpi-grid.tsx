'use client';

import 'react-grid-layout/css/styles.css';
import { type HTMLAttributes, type ReactNode, type Ref, useMemo } from 'react';
import { GridLayout, type Layout, useContainerWidth } from 'react-grid-layout';
import { KPI_COLUMNS, KPI_LIMITS, type KpiDashboard, type KpiLayoutItem } from '@/lib/kpi';
import { completeLayout, layoutBottom, rowsToPx, sameLayout, stackOrder } from '../../logic/kpi';
import { DRAG_HANDLE, NO_DRAG } from './kpi-panel';

export const ROW_HEIGHT = 40;
export const MARGIN = 12;
/** Below this container width the grid collapses to one column, in reading order. */
export const STACK_BELOW = 720;

const GRID_CONFIG = {
  cols: KPI_COLUMNS,
  rowHeight: ROW_HEIGHT,
  margin: [MARGIN, MARGIN] as const,
  containerPadding: [0, 0] as const,
};

/** `DraggableCore` clones this element to inject its mouse/touch handlers: they must reach the span. */
function ResizeHandle({
  handleRef,
  ...handlers
}: { handleRef: Ref<HTMLElement> } & HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      {...handlers}
      ref={handleRef as Ref<HTMLSpanElement>}
      aria-hidden="true"
      className="text-tertiary hover:text-foreground absolute right-0.5 bottom-0.5 z-10 grid size-5 cursor-se-resize touch-none place-items-center [.react-resizable-hide>&]:hidden"
    >
      <svg viewBox="0 0 10 10" className="size-2.5" fill="none" aria-hidden="true">
        <path d="M9 3 3 9M9 7 7 9" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
      </svg>
    </span>
  );
}

export function KpiGrid({
  dashboard,
  editing,
  onLayoutChange,
  renderPanel,
  hint,
}: {
  dashboard: KpiDashboard;
  editing: boolean;
  onLayoutChange: (layout: KpiLayoutItem[]) => void;
  renderPanel: (id: string, options: { draggable: boolean }) => ReactNode;
  /** Shown above the grid while editing; the stacked text explains why panels cannot move. */
  hint?: { grid: string; stacked: string } | null;
}) {
  const { width, containerRef, mounted } = useContainerWidth({ measureBeforeMount: true });
  const layout = useMemo(() => completeLayout(dashboard), [dashboard]);
  const rglLayout = useMemo<Layout>(
    () =>
      layout.map((l) => ({
        ...l,
        minW: KPI_LIMITS.minW,
        minH: KPI_LIMITS.minH,
        maxH: KPI_LIMITS.maxH,
      })),
    [layout],
  );
  const stacked = width < STACK_BELOW;
  const interactive = editing && !stacked;
  const dragConfig = useMemo(
    () => ({ enabled: interactive, handle: `.${DRAG_HANDLE}`, cancel: `.${NO_DRAG}` }),
    [interactive],
  );
  const resizeConfig = useMemo(
    () => ({
      enabled: interactive,
      handles: ['se'] as const,
      handleComponent: (_axis: unknown, ref: Ref<HTMLElement>) => <ResizeHandle handleRef={ref} />,
    }),
    [interactive],
  );

  const height = rowsToPx(layoutBottom(layout), ROW_HEIGHT, MARGIN);
  const heightOf = new Map(layout.map((l) => [l.i, rowsToPx(l.h, ROW_HEIGHT, MARGIN)]));

  // Only the 12-column layout is persisted, and only when the user finishes a drag or a resize:
  // the layout callbacks the grid fires on mount, on remount after the single column or after
  // compaction never write back, and nothing is written when no position actually changed.
  const commit = (next: Layout) => {
    if (!interactive) return;
    const items = next.map(({ i, x, y, w, h }) => ({ i, x, y, w, h }));
    if (!sameLayout(items, layout)) onLayoutChange(items);
  };

  return (
    <div ref={containerRef} className="flex w-full flex-col gap-3">
      {mounted && editing && hint ? (
        <p className="text-tertiary text-xs">{stacked ? hint.stacked : hint.grid}</p>
      ) : null}
      {!mounted ? (
        <div aria-hidden="true" style={{ height }} />
      ) : stacked ? (
        <div className="flex flex-col gap-3">
          {stackOrder(dashboard).map((id) => (
            <div key={id} style={{ height: heightOf.get(id) ?? rowsToPx(6, ROW_HEIGHT, MARGIN) }}>
              {renderPanel(id, { draggable: false })}
            </div>
          ))}
        </div>
      ) : (
        <GridLayout
          width={width}
          layout={rglLayout}
          gridConfig={GRID_CONFIG}
          dragConfig={dragConfig}
          resizeConfig={resizeConfig}
          onDragStop={commit}
          onResizeStop={commit}
          className="[&_.react-grid-placeholder]:border-border-strong [&_.react-grid-placeholder]:rounded-xl! [&_.react-grid-placeholder]:border [&_.react-grid-placeholder]:border-dashed [&_.react-grid-placeholder]:bg-(--active)! [&_.react-grid-placeholder]:opacity-100!"
        >
          {dashboard.panels.map((p) => (
            <div key={p.id} className="min-h-0 min-w-0">
              {renderPanel(p.id, { draggable: interactive })}
            </div>
          ))}
        </GridLayout>
      )}
    </div>
  );
}
