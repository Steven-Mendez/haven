'use client';

import { useChat } from '@ai-sdk/react';
import { isToolUIPart } from 'ai';
import {
  ArrowUp,
  ChartLine,
  ChartNoAxesCombined,
  Check,
  ChevronDown,
  Copy,
  Download,
  FileText,
  History,
  KeyRound,
  type LucideIcon,
  Rocket,
  RotateCw,
  SlidersHorizontal,
  Sparkles,
  Square,
  SquarePen,
  Trash2,
  TriangleAlert,
  Users,
} from 'lucide-react';
import {
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Hint } from '@/components/haven/hint';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Spinner } from '@/components/ui/spinner';
import type { KpiTexts } from '@/features/extras/components/kpi/texts';
import { format, formatDateTime, type Language } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { AssistantTexts } from '../i18n';
import {
  answerMissionSwitch,
  bridge,
  chatFor,
  currentChatId,
  deleteChat,
  newChatId,
  readHistory,
  readPreferences,
  type SavedChat,
  saveChat,
  savePreferences,
  setCurrentChatId,
} from '../store';
import {
  type AssistantMessage,
  DEFAULT_PREFERENCES,
  EFFORTS,
  type Effort,
  MODELS,
  type ModelId,
  type Preferences,
} from '../types';
import { Markdown } from './markdown';
import { ToolPart } from './tool-parts';

type Props = {
  lang: Language;
  t: AssistantTexts;
  kpi: KpiTexts;
  mission: { code: string; name: string } | null;
  configured: boolean;
};

// As wide as the other pages of the console: charts and dashboards use the screen.
const COLUMN = 'mx-auto w-full max-w-[1200px] px-4 sm:px-6';

const textOf = (message: AssistantMessage) =>
  message.parts
    .flatMap((p) => (p.type === 'text' ? [p.text] : []))
    .join('\n\n')
    .trim();

const effortName = (t: AssistantTexts, effort: Effort) =>
  ({ low: t.effortLow, medium: t.effortMedium, high: t.effortHigh })[effort];
const effortHint = (t: AssistantTexts, effort: Effort) =>
  ({ low: t.effortLowHint, medium: t.effortMediumHint, high: t.effortHighHint })[effort];

function errorMessage(error: Error, t: AssistantTexts): string {
  const text = error.message;
  if (text.includes('not-configured')) return t.notConfiguredDetail;
  if (text.includes('too-long')) return t.errorTooLong;
  if (text === 'auth') return t.errorAuth;
  if (text === 'busy') return t.errorBusy;
  return t.errorFailed;
}

/** A quiet choice inside the composer: the value, and a caret that says it opens. */
function Choice({ label, children }: { label: string; children: string }) {
  return (
    <DropdownMenuTrigger
      render={
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label={`${label}: ${children}`}
          className="gap-1 rounded-full px-2.5"
        />
      }
    >
      {children}
      <ChevronDown aria-hidden="true" className="text-tertiary" />
    </DropdownMenuTrigger>
  );
}

function Composer({
  t,
  mission,
  busy,
  disabled,
  preferences,
  onPreferences,
  onSend,
  onStop,
}: {
  t: AssistantTexts;
  mission: Props['mission'];
  busy: boolean;
  disabled: boolean;
  preferences: Preferences;
  onPreferences: (next: Preferences) => void;
  onSend: (text: string) => void;
  onStop: () => void;
}) {
  const [value, setValue] = useState('');
  const ready = value.trim().length > 0 && !busy && !disabled;
  const submit = () => {
    if (!ready) return;
    onSend(value.trim());
    setValue('');
  };
  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    submit();
  };
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    submit();
  };
  const model = MODELS.find((m) => m.id === preferences.model) ?? MODELS[0];

  return (
    <form
      onSubmit={onSubmit}
      data-testid="orion-composer"
      className="bg-card focus-within:border-border-strong flex w-full flex-col gap-1 rounded-3xl border p-2 text-left shadow-sm transition-[border-color,box-shadow] focus-within:shadow-md"
    >
      <textarea
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={onKeyDown}
        placeholder={t.placeholder}
        aria-label={t.placeholder}
        rows={1}
        disabled={disabled}
        // biome-ignore lint/a11y/noAutofocus: the chat is the only task on this page
        autoFocus
        className="placeholder:text-muted-foreground field-sizing-content max-h-48 min-h-11 w-full resize-none bg-transparent px-3 pt-2.5 pb-1 text-base outline-none disabled:cursor-not-allowed md:text-sm"
      />
      <div className="flex items-center gap-0.5 pl-1.5">
        <span
          title={mission ? format(t.missionChip, mission) : t.noMissionChip}
          className="text-muted-foreground hidden h-7 max-w-52 items-center gap-1.5 rounded-full border px-2.5 text-xs sm:inline-flex"
        >
          <Rocket aria-hidden="true" className="size-3.5 shrink-0" />
          <span className="truncate">{mission ? mission.name : t.noMissionChip}</span>
        </span>
        <div className="flex-1" />
        <DropdownMenu>
          <Choice label={t.modelLabel}>{model.name}</Choice>
          <DropdownMenuContent side="top" align="end" className="w-56">
            <DropdownMenuRadioGroup
              value={preferences.model}
              onValueChange={(next) => onPreferences({ ...preferences, model: next as ModelId })}
            >
              {MODELS.map((m) => (
                <DropdownMenuRadioItem key={m.id} value={m.id} className="items-start py-1.5">
                  <span className="flex flex-col">
                    <span>{m.name}</span>
                    <span className="text-muted-foreground text-xs">{t[m.hint]}</span>
                  </span>
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
          <Choice label={t.effortLabel}>{effortName(t, preferences.effort)}</Choice>
          <DropdownMenuContent side="top" align="end" className="w-64">
            <DropdownMenuRadioGroup
              value={preferences.effort}
              onValueChange={(next) => onPreferences({ ...preferences, effort: next as Effort })}
            >
              {EFFORTS.map((effort) => (
                <DropdownMenuRadioItem key={effort} value={effort} className="items-start py-1.5">
                  <span className="flex flex-col">
                    <span>{effortName(t, effort)}</span>
                    <span className="text-muted-foreground text-xs">{effortHint(t, effort)}</span>
                  </span>
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
        {busy ? (
          <Button
            type="button"
            size="icon"
            className="ml-1 rounded-full"
            aria-label={t.stop}
            title={t.stop}
            onClick={onStop}
          >
            <Square className="size-3 fill-current" />
          </Button>
        ) : (
          <Button
            type="submit"
            size="icon"
            className="ml-1 rounded-full"
            aria-label={t.send}
            title={t.send}
            disabled={!ready}
          >
            <ArrowUp />
          </Button>
        )}
      </div>
    </form>
  );
}

/** Orion's mark, with a soft glow so the empty page has a focal point. */
function Mark() {
  return (
    <span aria-hidden="true" className="relative flex size-12 items-center justify-center">
      <span className="bg-brand/30 absolute inset-1 rounded-full blur-xl" />
      <span className="bg-surface-elevated relative flex size-12 items-center justify-center rounded-2xl border shadow-sm">
        <Sparkles className="text-brand size-5" />
      </span>
    </span>
  );
}

function Suggestions({
  t,
  mission,
  onPick,
}: {
  t: AssistantTexts;
  mission: Props['mission'];
  onPick: (text: string) => void;
}) {
  const items: { icon: LucideIcon; label: string; prompt: string }[] = mission
    ? [
        { icon: Users, label: t.chipCrew, prompt: t.suggestCrew },
        { icon: ChartNoAxesCombined, label: t.chipKpi, prompt: t.suggestKpi },
        { icon: ChartLine, label: t.chipChart, prompt: t.suggestChart },
        { icon: FileText, label: t.chipReport, prompt: t.suggestReport },
        { icon: SlidersHorizontal, label: t.chipThreshold, prompt: t.suggestThreshold },
        { icon: Rocket, label: t.chipMissions, prompt: t.suggestMissions },
      ]
    : [
        { icon: Rocket, label: t.chipCreate, prompt: t.suggestCreate },
        { icon: Users, label: t.chipMissions, prompt: t.suggestMissions },
      ];
  return (
    <ul className="flex flex-wrap justify-center gap-2">
      {items.map(({ icon: Icon, label, prompt }) => (
        <li key={label}>
          <button
            type="button"
            title={prompt}
            onClick={() => onPick(prompt)}
            className="text-muted-foreground hover:text-foreground hover:bg-hover hover:border-border-strong inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs transition-colors"
          >
            <Icon aria-hidden="true" className="size-3.5" />
            {label}
          </button>
        </li>
      ))}
    </ul>
  );
}

function ReplyActions({ message, t }: { message: AssistantMessage; t: AssistantTexts }) {
  const [copied, setCopied] = useState(false);
  const text = textOf(message);
  if (!text) return null;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };
  const download = () => {
    const url = URL.createObjectURL(new Blob([`${text}\n`], { type: 'text/markdown' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${t.reportFile}-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <div className="-ml-1.5 flex items-center gap-0.5">
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label={copied ? t.copied : t.copy}
        title={copied ? t.copied : t.copy}
        onClick={copy}
      >
        {copied ? <Check /> : <Copy />}
      </Button>
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label={t.download}
        title={t.download}
        onClick={download}
      >
        <Download />
      </Button>
    </div>
  );
}

function MessageView({
  message,
  finished,
  lang,
  t,
  kpi,
  onApprove,
  onSwitch,
}: {
  message: AssistantMessage;
  finished: boolean;
  lang: Language;
  t: AssistantTexts;
  kpi: KpiTexts;
  onApprove: (id: string, approved: boolean) => void;
  onSwitch: (toolCallId: string, code: string, approved: boolean) => void;
}) {
  if (message.role === 'user')
    return (
      <div className="flex justify-end" data-testid="orion-user">
        <div className="bg-muted max-w-[min(85%,42rem)] rounded-3xl px-4 py-2.5 text-sm leading-relaxed break-words whitespace-pre-wrap">
          <span className="sr-only">{t.you}: </span>
          {textOf(message)}
        </div>
      </div>
    );
  // Stats and gauges asked for together sit side by side, like on the KPI page.
  const blocks: ReactNode[] = [];
  let row: ReactNode[] = [];
  const flush = (key: string) => {
    if (row.length === 0) return;
    blocks.push(
      <div
        key={key}
        className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 [&>section]:max-w-none"
      >
        {row}
      </div>,
    );
    row = [];
  };
  message.parts.forEach((part, index) => {
    // Parts only grow at the end while a reply streams, so the position is a stable key.
    const key = `${message.id}-${index}`;
    if (part.type === 'step-start') return;
    if (part.type === 'text') {
      if (!part.text.trim()) return;
      flush(`${key}-row`);
      blocks.push(<Markdown key={key} text={part.text} />);
      return;
    }
    if (!isToolUIPart(part) || part.type === 'dynamic-tool') return;
    const node = (
      <ToolPart
        key={key}
        part={part}
        lang={lang}
        t={t}
        kpi={kpi}
        onApprove={onApprove}
        onSwitch={onSwitch}
      />
    );
    const small =
      part.type === 'tool-showPanel' &&
      part.state === 'output-available' &&
      'view' in part.output &&
      (part.output.view.panel.type === 'stat' || part.output.view.panel.type === 'gauge');
    if (small) row.push(node);
    else {
      flush(`${key}-row`);
      blocks.push(node);
    }
  });
  flush(`${message.id}-row`);

  return (
    <div className="flex min-w-0 flex-col gap-3" data-testid="orion-reply">
      {blocks}
      {finished ? <ReplyActions message={message} t={t} /> : null}
    </div>
  );
}

export function OrionChat({ lang, t, kpi, mission, configured }: Props) {
  const [chatId, setChatId] = useState(currentChatId);
  const chat = useMemo(() => chatFor(chatId), [chatId]);
  const {
    messages,
    sendMessage,
    status,
    stop,
    error,
    clearError,
    regenerate,
    addToolApprovalResponse,
  } = useChat<AssistantMessage>({ chat });
  const [history, setHistory] = useState<SavedChat[]>([]);
  const [preferences, setPreferences] = useState<Preferences>(DEFAULT_PREFERENCES);
  const busy = status === 'submitted' || status === 'streaming';

  // Every request carries the mission this page shows, so Orion never answers about another.
  const shownMission = mission?.code ?? null;
  useEffect(() => {
    bridge.mission = shownMission;
  }, [shownMission]);

  useEffect(() => {
    setHistory(readHistory());
    setPreferences(readPreferences());
  }, []);

  // Keep the conversation in this browser once a turn settles (not on every token).
  const baseline = useRef<{ id: string; messages: AssistantMessage[] } | null>(null);
  useEffect(() => {
    if (baseline.current?.id !== chatId) {
      baseline.current = { id: chatId, messages };
      return;
    }
    if (busy || messages === baseline.current.messages) return;
    baseline.current = { id: chatId, messages };
    setHistory(saveChat(chatId, messages));
  }, [chatId, messages, busy]);

  // Follow the answer while the operator is at the bottom; leave them alone if they scrolled up.
  // Only their own scrolling changes that: content growing below does not fire a scroll event.
  const root = useRef<HTMLDivElement>(null);
  const end = useRef<HTMLDivElement>(null);
  const following = useRef(true);
  useEffect(() => {
    const onScroll = () => {
      const node = end.current;
      if (node) following.current = node.getBoundingClientRect().top - window.innerHeight < 160;
    };
    document.addEventListener('scroll', onScroll, { capture: true, passive: true });
    // Text streams in and charts take their height after they mount: follow every growth.
    const observer = new ResizeObserver(() => {
      if (following.current) end.current?.scrollIntoView({ block: 'end' });
    });
    if (root.current) observer.observe(root.current);
    return () => {
      document.removeEventListener('scroll', onScroll, { capture: true });
      observer.disconnect();
    };
  }, []);

  const open = (id: string) => {
    setCurrentChatId(id);
    setChatId(id);
    following.current = true;
  };
  const send = (text: string) => {
    if (error) clearError();
    following.current = true;
    void sendMessage({ text });
    // The first message swaps the welcome for the conversation: start from its end.
    requestAnimationFrame(() => end.current?.scrollIntoView({ block: 'end' }));
  };
  const choose = (next: Preferences) => {
    setPreferences(next);
    savePreferences(next);
  };

  const empty = messages.length === 0;
  const last = messages.at(-1);
  const tail = last?.parts.at(-1);
  // The model is working but nothing new is on screen yet: after sending, or between tool steps.
  const waiting =
    busy &&
    (last?.role !== 'assistant' ||
      tail === undefined ||
      tail.type === 'step-start' ||
      (isToolUIPart(tail) &&
        (tail.state === 'output-available' || tail.state === 'output-denied')));

  const composer = (
    <Composer
      t={t}
      mission={mission}
      busy={busy}
      disabled={!configured}
      preferences={preferences}
      onPreferences={choose}
      onSend={send}
      onStop={() => void stop()}
    />
  );
  const keyNotice = configured ? null : (
    <p
      role="alert"
      className="border-level-amber-border bg-level-amber-bg flex w-full items-start gap-2.5 rounded-2xl border px-3.5 py-2.5 text-left text-xs"
    >
      <KeyRound aria-hidden="true" className="text-level-amber mt-0.5 size-3.5 shrink-0" />
      <span>
        <span className="font-medium">{t.notConfiguredTitle}.</span>{' '}
        <span className="text-muted-foreground">{t.notConfiguredDetail}</span>
      </span>
    </p>
  );

  return (
    <div ref={root} className="relative flex min-h-0 flex-1 flex-col" data-testid="orion">
      <div className="absolute top-2.5 right-3 z-20 flex items-center gap-0.5 md:right-5">
        <DropdownMenu>
          <Hint label={t.history}>
            <DropdownMenuTrigger
              render={<Button variant="ghost" size="icon-sm" aria-label={t.history} />}
            >
              <History />
            </DropdownMenuTrigger>
          </Hint>
          <DropdownMenuContent align="end" className="w-80">
            {history.length === 0 ? (
              <p className="text-muted-foreground px-2 py-3 text-xs">{t.historyEmpty}</p>
            ) : (
              history.map((saved) => (
                <DropdownMenuItem
                  key={saved.id}
                  onClick={() => open(saved.id)}
                  className={cn('items-start gap-2 py-1.5', saved.id === chatId && 'bg-active')}
                >
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate">{saved.title}</span>
                    <span className="text-muted-foreground text-xs">
                      {formatDateTime(saved.updatedAt, lang)}
                    </span>
                  </span>
                  <button
                    type="button"
                    aria-label={format(t.deleteChat, { title: saved.title })}
                    title={format(t.deleteChat, { title: saved.title })}
                    className="text-tertiary hover:text-foreground mt-0.5 rounded-sm p-0.5"
                    onClick={(event) => {
                      event.stopPropagation();
                      event.preventDefault();
                      setHistory(deleteChat(saved.id));
                      if (saved.id === chatId) open(newChatId());
                    }}
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </DropdownMenuItem>
              ))
            )}
            <p className="text-tertiary text-2xs mt-1 border-t px-2 pt-2 pb-1">{t.historyNote}</p>
          </DropdownMenuContent>
        </DropdownMenu>
        <Hint label={t.newChat}>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t.newChat}
            disabled={empty}
            onClick={() => open(newChatId())}
          >
            <SquarePen />
          </Button>
        </Hint>
      </div>

      {empty ? (
        <>
          <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-7 px-4 pt-14 pb-[10vh] text-center sm:px-6">
            <div className="flex flex-col items-center gap-4">
              <Mark />
              <div className="flex flex-col gap-2">
                <h1 className="text-2xl font-semibold tracking-[-0.02em] text-balance sm:text-[28px] sm:leading-9">
                  {mission ? t.greeting : t.greetingNoMission}
                </h1>
                <p className="text-muted-foreground mx-auto max-w-md text-sm text-pretty">
                  {t.intro}
                </p>
              </div>
            </div>
            <div className="flex w-full flex-col gap-3">
              {keyNotice}
              {composer}
            </div>
            <Suggestions t={t} mission={mission} onPick={send} />
          </div>
          <p className="text-tertiary text-2xs px-4 pb-4 text-center">{t.disclaimer}</p>
        </>
      ) : (
        <>
          <div className={cn(COLUMN, 'flex flex-1 flex-col')}>
            <div className="flex flex-col gap-7 pt-14 pb-6" aria-live="polite">
              {messages.map((message, index) => (
                <MessageView
                  key={message.id}
                  message={message}
                  finished={!busy || index < messages.length - 1}
                  lang={lang}
                  t={t}
                  kpi={kpi}
                  onApprove={(id, approved) => void addToolApprovalResponse({ id, approved })}
                  onSwitch={(toolCallId, code, approved) =>
                    void answerMissionSwitch(chat, toolCallId, code, approved)
                  }
                />
              ))}
              {waiting ? (
                <p className="text-tertiary flex items-center gap-2 text-xs" role="status">
                  <Spinner className="size-3" />
                  {t.thinking}
                </p>
              ) : null}
              {error ? (
                <div
                  role="alert"
                  className="border-level-red-border bg-level-red-bg flex flex-wrap items-center gap-3 rounded-2xl border px-3.5 py-2.5 text-sm"
                >
                  <TriangleAlert aria-hidden="true" className="text-level-red size-4 shrink-0" />
                  <span className="min-w-0 flex-1">{errorMessage(error, t)}</span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      clearError();
                      void regenerate();
                    }}
                  >
                    <RotateCw data-icon="inline-start" />
                    {t.retry}
                  </Button>
                </div>
              ) : null}
            </div>
            <div className="flex-1" />
          </div>
          <div className="from-background via-background md:from-surface md:via-surface sticky bottom-0 z-10 bg-linear-to-t to-transparent pt-8 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <div className={cn(COLUMN, 'flex flex-col gap-2')}>
              {keyNotice}
              {composer}
              <p className="text-tertiary text-2xs text-center">{t.disclaimer}</p>
            </div>
          </div>
        </>
      )}
      <div ref={end} aria-hidden="true" />
    </div>
  );
}
