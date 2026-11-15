'use client';

import { getToolName, type ToolUIPart } from 'ai';
import { Check, CircleCheck, CircleSlash, Copy, ShieldAlert, TriangleAlert, X } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { type KpiTexts, rangeLong } from '@/features/extras/components/kpi/texts';
import { format, type Language } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { AssistantTexts } from '../i18n';
import { type AssistantTools, WRITE_TOOLS, type WriteResult } from '../types';
import { ChartCard } from './chart-card';
import { CountermeasureCard } from './countermeasure-card';
import { PanelCard } from './panel-card';

type Part = ToolUIPart<AssistantTools>;
type Approve = (id: string, approved: boolean) => void;
type Switch = (toolCallId: string, code: string, approved: boolean) => void;

const DESTRUCTIVE = new Set(['removeCrewMember', 'finishMission']);
const isWrite = (name: string) => (WRITE_TOOLS as readonly string[]).includes(name);

const labelOf = (t: AssistantTexts, name: string) =>
  (t as Record<string, string>)[`tool_${name}`] ?? name;

/** A short word from the call that tells similar lookups apart: the area, the crew member… */
function detailOf(input: unknown): string | null {
  if (typeof input !== 'object' || input === null) return null;
  const value = Object.values(input).find((v) => typeof v === 'string' && v.length <= 60);
  return typeof value === 'string' ? value : null;
}

/** One quiet line per lookup, like a log of what Orion consulted. */
function Activity({
  label,
  detail,
  state,
  note,
}: {
  label: string;
  detail?: string | null;
  state: 'running' | 'done' | 'failed';
  note?: string;
}) {
  return (
    <p className="text-tertiary flex min-w-0 items-center gap-2 text-xs" data-testid="orion-tool">
      {state === 'running' ? (
        <Spinner className="size-3 shrink-0" />
      ) : state === 'done' ? (
        <Check aria-hidden="true" className="size-3 shrink-0" />
      ) : (
        <X aria-hidden="true" className="size-3 shrink-0" />
      )}
      <span className="truncate">
        {label}
        {detail ? <span className="text-muted-foreground"> · {detail}</span> : null}
        {note ? ` · ${note}` : null}
      </span>
    </p>
  );
}

/** The plan the server computed for a change: first line is what, the rest is the detail. */
function Plan({ text }: { text?: string }) {
  const [head, ...rest] = (text ?? '').split('\n').filter(Boolean);
  if (!head) return null;
  return (
    <div className="flex flex-col gap-1">
      <p className="text-sm font-medium">{head}</p>
      {rest.length ? (
        <ul className="text-muted-foreground flex flex-col gap-0.5 text-xs tabular-nums">
          {rest.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function ChangeFrame({
  icon,
  title,
  status,
  tone = 'plain',
  children,
}: {
  icon: React.ReactNode;
  title: string;
  status?: string;
  tone?: 'plain' | 'ask' | 'bad';
  children?: React.ReactNode;
}) {
  return (
    <section
      data-testid="orion-change"
      className={cn(
        'bg-card flex w-full max-w-xl flex-col gap-3 rounded-xl border p-3.5',
        tone === 'ask' && 'border-border-strong',
        tone === 'bad' && 'border-level-red-border',
      )}
    >
      <header className="flex items-center gap-2 text-xs">
        <span className="shrink-0 [&_svg]:size-3.5">{icon}</span>
        <span className="font-medium">{title}</span>
        {status ? <span className="text-tertiary ml-auto truncate">{status}</span> : null}
      </header>
      {children}
    </section>
  );
}

/** A change waiting for the operator, then what became of it. */
function Change({ part, t, onApprove }: { part: Part; t: AssistantTexts; onApprove: Approve }) {
  const name = getToolName(part);
  const title = labelOf(t, name);
  const plan = part.approval?.requestReason;

  if (part.state === 'approval-requested' && !part.approval.isAutomatic) {
    const { id } = part.approval;
    return (
      <ChangeFrame
        tone="ask"
        icon={<ShieldAlert aria-hidden="true" className="text-level-amber" />}
        title={title}
        status={t.approvalTitle}
      >
        <Plan text={plan} />
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant={DESTRUCTIVE.has(name) ? 'destructive' : 'default'}
            onClick={() => onApprove(id, true)}
          >
            {t.approve}
          </Button>
          <Button size="sm" variant="outline" onClick={() => onApprove(id, false)}>
            {t.reject}
          </Button>
        </div>
      </ChangeFrame>
    );
  }

  if (part.state === 'approval-responded' && part.approval.approved)
    return (
      <ChangeFrame icon={<Spinner className="size-3.5" />} title={title} status={t.approving}>
        <Plan text={plan} />
      </ChangeFrame>
    );

  if (part.state === 'output-available') {
    const result = part.output as WriteResult;
    return result.ok ? (
      <ChangeFrame
        icon={<CircleCheck aria-hidden="true" className="text-level-green" />}
        title={title}
        status={t.approved}
      >
        <Plan text={plan} />
      </ChangeFrame>
    ) : (
      <ChangeFrame
        tone="bad"
        icon={<TriangleAlert aria-hidden="true" className="text-level-red" />}
        title={title}
        status={t.failed}
      >
        <Plan text={plan} />
      </ChangeFrame>
    );
  }

  if (part.state === 'output-error')
    return (
      <ChangeFrame
        tone="bad"
        icon={<TriangleAlert aria-hidden="true" className="text-level-red" />}
        title={title}
        status={t.failed}
      >
        <Plan text={plan} />
      </ChangeFrame>
    );

  if (
    part.state === 'output-denied' ||
    (part.state === 'approval-responded' && !part.approval.approved)
  ) {
    // Refused by the server before asking (it could not be done) or rejected by the operator.
    const refused = part.approval.isAutomatic === true;
    return refused ? (
      <Activity label={title} state="failed" note={t.refused} />
    ) : (
      <ChangeFrame
        icon={<CircleSlash aria-hidden="true" className="text-tertiary" />}
        title={title}
        status={t.rejected}
      >
        <Plan text={plan} />
      </ChangeFrame>
    );
  }

  return <Activity label={title} state="running" note={t.preparing} />;
}

/** Orion asks to change the active mission; only the operator's click does it. */
function MissionSwitch({
  part,
  t,
  onSwitch,
}: {
  part: Extract<Part, { type: 'tool-switchMission' }>;
  t: AssistantTexts;
  onSwitch: Switch;
}) {
  const title = labelOf(t, 'switchMission');
  if (part.state === 'input-streaming') return <Activity label={title} state="running" />;
  const code = String(part.input?.code ?? '').toUpperCase();
  const plan = `${format(t.switchAsk, { code })}\n${t.switchNote}`;
  if (part.state === 'input-available') {
    const { toolCallId } = part;
    return (
      <ChangeFrame
        tone="ask"
        icon={<ShieldAlert aria-hidden="true" className="text-level-amber" />}
        title={title}
        status={t.approvalTitle}
      >
        <Plan text={plan} />
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => onSwitch(toolCallId, code, true)}>
            {t.approve}
          </Button>
          <Button size="sm" variant="outline" onClick={() => onSwitch(toolCallId, code, false)}>
            {t.reject}
          </Button>
        </div>
      </ChangeFrame>
    );
  }
  if (part.state === 'output-available' && part.output.ok)
    return (
      <ChangeFrame
        icon={<CircleCheck aria-hidden="true" className="text-level-green" />}
        title={title}
        status={t.switchDone}
      >
        <Plan text={plan} />
      </ChangeFrame>
    );
  return (
    <ChangeFrame
      icon={<CircleSlash aria-hidden="true" className="text-tertiary" />}
      title={title}
      status={part.state === 'output-available' ? t.switchDeclined : t.failed}
    >
      <Plan text={plan} />
    </ChangeFrame>
  );
}

function Invitation({
  name,
  mission,
  link,
  qrSvg,
  t,
}: {
  name: string;
  mission: string;
  link: string;
  qrSvg: string;
  t: AssistantTexts;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <section className="bg-card flex w-full max-w-md items-center gap-4 rounded-xl border p-3.5">
      {/* biome-ignore lint/performance/noImgElement: an inline SVG data URL; next/image adds nothing */}
      <img
        src={`data:image/svg+xml;utf8,${encodeURIComponent(qrSvg)}`}
        alt=""
        className="size-28 shrink-0 rounded-lg bg-white p-1.5"
      />
      <div className="flex min-w-0 flex-col gap-2">
        <p className="text-sm font-medium">{format(t.invitationFor, { name, mission })}</p>
        <p className="text-muted-foreground text-xs">{t.invitationHint}</p>
        <Button
          size="sm"
          variant="outline"
          className="w-fit"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(link);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            } catch {
              setCopied(false);
            }
          }}
        >
          {copied ? <Check data-icon="inline-start" /> : <Copy data-icon="inline-start" />}
          {copied ? t.copied : t.copyLink}
        </Button>
      </div>
    </section>
  );
}

export function ToolPart({
  part,
  lang,
  t,
  kpi,
  onApprove,
  onSwitch,
}: {
  part: Part;
  lang: Language;
  t: AssistantTexts;
  kpi: KpiTexts;
  onApprove: Approve;
  onSwitch: Switch;
}) {
  const name = getToolName(part);
  if (isWrite(name)) return <Change part={part} t={t} onApprove={onApprove} />;
  if (part.type === 'tool-switchMission')
    return <MissionSwitch part={part} t={t} onSwitch={onSwitch} />;

  const label = labelOf(t, name);
  const failed = part.state === 'output-error';

  if (part.type === 'tool-showPanel') {
    if (part.state === 'output-available')
      return 'view' in part.output ? (
        <PanelCard view={part.output.view} lang={lang} t={t} kpi={kpi} />
      ) : (
        <Activity label={label} state="failed" note={t.toolFailed} />
      );
    return failed ? (
      <Activity label={label} state="failed" note={t.toolFailed} />
    ) : (
      <div className="bg-card text-tertiary flex h-24 w-full items-center justify-center gap-2 rounded-xl border text-xs">
        <Spinner className="size-3.5" />
        {t.panelLoading}
      </div>
    );
  }

  if (part.type === 'tool-showChart' || part.type === 'tool-showKpiDashboard') {
    if (part.state !== 'output-available')
      return failed ? (
        <Activity label={label} state="failed" note={t.toolFailed} />
      ) : (
        <div className="bg-card text-tertiary flex h-24 w-full items-center justify-center gap-2 rounded-xl border text-xs">
          <Spinner className="size-3.5" />
          {t.panelLoading}
        </div>
      );
    if (part.type === 'tool-showChart' && 'chart' in part.output)
      return <ChartCard chart={part.output.chart} lang={lang} t={t} />;
    if (part.type === 'tool-showKpiDashboard' && 'views' in part.output) {
      const { views } = part.output;
      const period = views.every((v) => v.range === views[0]?.range) ? views[0]?.range : undefined;
      return (
        <div className="flex w-full flex-col gap-2" data-testid="orion-dashboard">
          <p className="text-tertiary text-xs">
            {label}
            {period ? ` · ${rangeLong(kpi, period)}` : null}
          </p>
          <div className="grid w-full grid-cols-2 gap-3 lg:grid-cols-4">
            {views.map((view) => (
              <div
                key={view.panel.id}
                className={cn(
                  'flex min-w-0 [&>section]:max-w-none',
                  view.panel.type === 'table'
                    ? 'col-span-full'
                    : view.panel.type === 'stat' || view.panel.type === 'gauge'
                      ? 'col-span-1'
                      : 'col-span-2',
                )}
              >
                <PanelCard view={view} lang={lang} t={t} kpi={kpi} />
              </div>
            ))}
          </div>
        </div>
      );
    }
    return <Activity label={label} state="failed" note={t.toolFailed} />;
  }

  if (
    part.type === 'tool-getCountermeasures' &&
    part.state === 'output-available' &&
    'card' in part.output
  )
    return <CountermeasureCard card={part.output.card} t={t} />;

  if (part.type === 'tool-getInvitation' && part.state === 'output-available')
    return 'link' in part.output ? (
      <Invitation
        name={part.output.name}
        mission={part.output.mission}
        link={part.output.link}
        qrSvg={part.output.qrSvg}
        t={t}
      />
    ) : (
      <Activity label={label} state="failed" note={t.toolFailed} />
    );

  const done = part.state === 'output-available';
  const refused =
    done && typeof part.output === 'object' && part.output !== null && 'error' in part.output;
  return (
    <Activity
      label={label}
      detail={detailOf(part.input)}
      state={failed || refused ? 'failed' : done ? 'done' : 'running'}
      note={failed || refused ? t.toolFailed : undefined}
    />
  );
}
