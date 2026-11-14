'use client';

import {
  CircleAlert,
  CircleCheck,
  Download,
  Link2,
  LoaderCircle,
  MoreHorizontal,
  Pencil,
  Plus,
  QrCode,
  Search,
  Trash2,
  Users,
  Watch,
} from 'lucide-react';
import Link from 'next/link';
import { useActionState, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { ago, Portrait } from '@/components/haven';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Field, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { format, type Language } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import {
  addCrewAction,
  type RosterFormState,
  removeCrewAction,
  updateCrewAction,
} from '../actions';
import { texts } from '../i18n';

export type RosterMember = {
  id: string;
  name: string;
  role?: string;
  waiting: boolean;
  signedIn: boolean;
  lastPacketAt: string | null;
  hasWatch: boolean;
  invite: { link: string; qr: string };
};

type Texts = (typeof texts)[Language];
type Filter = 'all' | 'sending' | 'invited';
type Panel = { kind: 'add' } | { kind: 'edit' | 'invite' | 'remove'; id: string } | null;

const IDLE: RosterFormState = { status: 'idle' };

const isLoopback = (url: string) => /\/\/(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/.test(url);

function RosterError({ state, t }: { state: RosterFormState; t: Texts }) {
  if (state.status !== 'error') return null;
  const message = state.code === 'name' ? t.rosterErrName : t.rosterErrSave;
  return (
    <p role="alert" className="text-foreground flex items-start gap-1.5 text-xs">
      <CircleAlert aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
      <span>{message}</span>
    </p>
  );
}

function StatusBadge({ waiting, signedIn, t }: { waiting: boolean; signedIn: boolean; t: Texts }) {
  if (waiting && signedIn) {
    return (
      <span className="text-foreground inline-flex h-6 items-center gap-1.5 rounded-md border px-2 text-xs whitespace-nowrap">
        <CircleCheck aria-hidden="true" className="size-3" />
        {t.statusSignedIn}
      </span>
    );
  }
  return (
    <span
      className={cn(
        'inline-flex h-6 items-center gap-1.5 rounded-md border px-2 text-xs whitespace-nowrap',
        waiting ? 'text-muted-foreground border-dashed' : 'text-foreground',
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'size-1.5 rounded-full',
          waiting ? 'border-tertiary border border-dashed' : 'bg-muted-foreground',
        )}
      />
      {waiting ? t.statusInvited : t.statusSending}
    </span>
  );
}

function MemberFields({
  t,
  member,
  invalid,
}: {
  t: Texts;
  member?: RosterMember;
  invalid?: boolean;
}) {
  return (
    <div className="flex flex-col gap-3">
      <Field>
        <FieldLabel htmlFor="crew-name">{t.rosterName}</FieldLabel>
        <Input
          id="crew-name"
          name="name"
          required
          maxLength={60}
          autoComplete="off"
          autoFocus
          placeholder={t.rosterNamePlaceholder}
          defaultValue={member?.name}
          aria-invalid={invalid ? true : undefined}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor="crew-role">{t.rosterRole}</FieldLabel>
        <Input
          id="crew-role"
          name="role"
          maxLength={60}
          autoComplete="off"
          placeholder={t.rosterRolePlaceholder}
          defaultValue={member?.role}
        />
      </Field>
    </div>
  );
}

function AddPanel({
  mission,
  t,
  onAdded,
  onCancel,
}: {
  mission: string;
  t: Texts;
  onAdded: (id: string, name: string) => void;
  onCancel: () => void;
}) {
  const [state, action, pending] = useActionState(addCrewAction.bind(null, mission), IDLE);
  const nameRef = useRef('');
  useEffect(() => {
    if (state.status === 'ok' && state.id) onAdded(state.id, nameRef.current);
  }, [state, onAdded]);
  return (
    <form
      action={(form) => {
        nameRef.current = String(form.get('name') ?? '').trim();
        return action(form);
      }}
      className="flex flex-col gap-5"
    >
      <div className="flex flex-col gap-1.5 pr-8">
        <SheetTitle>{t.rosterAdd}</SheetTitle>
        <SheetDescription>{t.addDescription}</SheetDescription>
      </div>
      <MemberFields t={t} invalid={state.status === 'error'} />
      <RosterError state={state} t={t} />
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          <Plus data-icon="inline-start" />
          {t.rosterAdd}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          {t.rosterCancel}
        </Button>
      </div>
    </form>
  );
}

function EditPanel({
  mission,
  member,
  t,
  onSaved,
  onCancel,
}: {
  mission: string;
  member: RosterMember;
  t: Texts;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [state, action, pending] = useActionState(
    updateCrewAction.bind(null, mission, member.id),
    IDLE,
  );
  useEffect(() => {
    if (state.status === 'ok') onSaved();
  }, [state, onSaved]);
  return (
    <form action={action} className="flex flex-col gap-5">
      <div className="flex items-center gap-3 pr-8">
        <Portrait id={member.id} name={member.name} size={40} />
        <div className="flex min-w-0 flex-col gap-1">
          <SheetTitle>{format(t.editTitle, { name: member.name })}</SheetTitle>
          <StatusBadge waiting={member.waiting} signedIn={member.signedIn} t={t} />
        </div>
      </div>
      <SheetDescription>{t.rosterManageBody}</SheetDescription>
      <MemberFields t={t} member={member} invalid={state.status === 'error'} />
      <p className="text-tertiary text-xs">
        {t.rosterId}: <span className="font-mono">{member.id}</span>
      </p>
      <RosterError state={state} t={t} />
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {t.rosterSave}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          {t.rosterCancel}
        </Button>
      </div>
    </form>
  );
}

function InvitePanel({
  mission,
  earthUrl,
  member,
  lang,
  onClose,
}: {
  mission: string;
  earthUrl: string;
  member: RosterMember;
  lang: Language;
  onClose: () => void;
}) {
  const t = texts[lang];
  const src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(member.invite.qr)}`;
  const steps = [t.inviteStep1, t.inviteStep2, format(t.inviteStep3, { name: member.name })];
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5 pr-8">
        <SheetTitle>{format(t.inviteTitle, { name: member.name })}</SheetTitle>
        <SheetDescription className="sr-only">{t.inviteStep2}</SheetDescription>
        <p
          role="status"
          className={cn(
            'flex items-center gap-1.5 text-sm',
            member.waiting && !member.signedIn ? 'text-muted-foreground' : 'text-foreground',
          )}
        >
          {member.waiting && !member.signedIn ? (
            <LoaderCircle
              aria-hidden="true"
              className="size-4 animate-spin motion-reduce:animate-none"
            />
          ) : (
            <CircleCheck aria-hidden="true" className="size-4" />
          )}
          {member.waiting
            ? member.signedIn
              ? format(t.inviteSignedIn, { name: member.name })
              : t.inviteWaitingLive
            : format(t.inviteJoined, { name: member.name })}
        </p>
      </div>
      <figure className="flex flex-col items-center gap-2 rounded-xl border p-4">
        {/* biome-ignore lint/performance/noImgElement: a data-URL SVG made on the server, nothing to optimize. */}
        <img
          src={src}
          alt={format(t.inviteQrLabel, { name: member.name })}
          width={208}
          height={208}
          className="rounded-lg bg-white p-1"
        />
        <figcaption className="text-center text-sm font-medium">
          {format(t.inviteFor, { name: member.name })}
          {member.role ? <span className="text-muted-foreground"> · {member.role}</span> : null}
        </figcaption>
      </figure>
      <ol className="flex flex-col gap-2">
        {steps.map((step, i) => (
          <li key={step} className="flex items-start gap-2 text-sm">
            <span className="bg-hover grid size-5 shrink-0 place-items-center rounded-full text-xs tabular-nums">
              {i + 1}
            </span>
            {step}
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(member.invite.link);
              toast.success(t.toastLinkCopied, { description: member.name });
            } catch {}
          }}
        >
          <Link2 data-icon="inline-start" />
          {t.menuCopyLink}
        </Button>
        <a
          href={src}
          download={`haven-${mission}-${member.id}.svg`}
          className={buttonVariants({ variant: 'outline', size: 'sm' })}
        >
          <Download data-icon="inline-start" />
          {t.inviteDownload}
        </a>
      </div>
      <div className="flex flex-col gap-2 border-t pt-4">
        <p className="text-tertiary text-xs break-all">
          {format(t.inviteEarth, { url: earthUrl })}
        </p>
        {isLoopback(earthUrl) ? (
          <p role="alert" className="text-foreground flex items-start gap-1.5 text-xs">
            <CircleAlert aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
            {t.inviteLocalhost}
          </p>
        ) : null}
      </div>
      <div>
        <Button type="button" variant="ghost" onClick={onClose}>
          {t.inviteClose}
        </Button>
      </div>
    </div>
  );
}

function RemovePanel({
  mission,
  member,
  t,
  onDone,
  onCancel,
}: {
  mission: string;
  member: RosterMember;
  t: Texts;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [typed, setTyped] = useState('');
  const [failed, setFailed] = useState(false);
  const [pending, start] = useTransition();
  const needsTyping = !member.waiting;
  const ready = !needsTyping || typed.trim() === member.id;
  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (!ready) return;
        start(async () => {
          const result = await removeCrewAction(mission, member.id);
          if (result.status === 'ok') {
            toast.success(format(t.toastRemoved, { name: member.name }));
            onDone();
          } else setFailed(true);
        });
      }}
    >
      <div className="flex items-center gap-3 pr-8">
        <Portrait id={member.id} name={member.name} size={40} />
        <SheetTitle>{format(t.removeTitle, { name: member.name })}</SheetTitle>
      </div>
      <SheetDescription className="text-foreground text-sm leading-6">
        {format(member.waiting ? t.removeWaiting : t.removeWithData, { mission })}
      </SheetDescription>
      {needsTyping ? (
        <Field>
          <FieldLabel htmlFor="crew-remove-confirm">
            {format(t.removeConfirmLabel, { id: member.id })}
          </FieldLabel>
          <Input
            id="crew-remove-confirm"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoComplete="off"
            spellCheck={false}
            className="font-mono"
          />
        </Field>
      ) : null}
      {failed ? <RosterError state={{ status: 'error', code: 'save' }} t={t} /> : null}
      <div className="flex gap-2">
        <Button type="submit" variant="outline" disabled={!ready || pending}>
          <Trash2 data-icon="inline-start" />
          {format(t.removeConfirm, { name: member.name })}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          {t.rosterCancel}
        </Button>
      </div>
    </form>
  );
}

function RowMenu({
  member,
  lang,
  onEdit,
  onRemove,
}: {
  member: RosterMember;
  lang: Language;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const t = texts[lang];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={format(t.menuLabel, { name: member.name })}
          />
        }
      >
        <MoreHorizontal />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-56">
        <DropdownMenuItem onClick={onEdit}>
          <Pencil />
          {t.rosterEdit}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(member.invite.link);
              toast.success(t.toastLinkCopied, { description: member.name });
            } catch {}
          }}
        >
          <Link2 />
          {t.menuCopyLink}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onRemove}>
          <Trash2 />
          {t.menuRemove}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function RosterManager({
  mission,
  earthUrl,
  members,
  now,
  lang,
  readOnly = false,
}: {
  mission: string;
  earthUrl: string;
  members: RosterMember[];
  now: string;
  lang: Language;
  readOnly?: boolean;
}) {
  const t = texts[lang];
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [panel, setPanel] = useState<Panel>(null);
  const close = () => setPanel(null);

  const counts = {
    all: members.length,
    sending: members.filter((m) => !m.waiting).length,
    invited: members.filter((m) => m.waiting).length,
  };
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return members.filter(
      (m) =>
        (filter === 'all' || (filter === 'invited') === m.waiting) &&
        (!q || `${m.name} ${m.role ?? ''} ${m.id}`.toLowerCase().includes(q)),
    );
  }, [members, filter, query]);

  const panelMember =
    panel && panel.kind !== 'add' ? members.find((m) => m.id === panel.id) : undefined;
  const filters: { id: Filter; label: string }[] = [
    { id: 'all', label: t.filterAll },
    { id: 'sending', label: t.filterSending },
    { id: 'invited', label: t.filterInvited },
  ];

  return (
    <section aria-labelledby="crew-roster-title" className="flex flex-col gap-3">
      <h2 id="crew-roster-title" className="sr-only">
        {t.manageTitle}
      </h2>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <fieldset className="flex gap-1">
          <legend className="sr-only">{t.filterLabel}</legend>
          {filters.map((f) => (
            <button
              key={f.id}
              type="button"
              aria-pressed={filter === f.id}
              onClick={() => setFilter(f.id)}
              className={cn(
                'hover:bg-hover text-muted-foreground inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-sm transition-colors',
                filter === f.id && 'bg-muted text-foreground',
              )}
            >
              {f.label}
              <span className="text-tertiary tabular-nums">{counts[f.id]}</span>
            </button>
          ))}
        </fieldset>
        <div className="flex flex-1 items-center justify-end gap-2">
          <div className="relative w-full max-w-64">
            <Search
              aria-hidden="true"
              className="text-tertiary pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2"
            />
            <Input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t.searchPlaceholder}
              aria-label={t.searchPlaceholder}
              className="pl-8"
            />
          </div>
          {readOnly ? null : (
            <Button onClick={() => setPanel({ kind: 'add' })}>
              <Plus data-icon="inline-start" />
              {t.rosterAdd}
            </Button>
          )}
        </div>
      </div>

      {members.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border px-6 py-12 text-center">
          <Users aria-hidden="true" className="text-tertiary size-5" />
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium">{t.rosterEmpty}</p>
            {readOnly ? null : <p className="text-muted-foreground text-xs">{t.emptyHint}</p>}
          </div>
          {readOnly ? null : (
            <Button variant="outline" onClick={() => setPanel({ kind: 'add' })}>
              <Plus data-icon="inline-start" />
              {t.rosterAdd}
            </Button>
          )}
        </div>
      ) : shown.length === 0 ? (
        <p className="text-muted-foreground rounded-xl border px-4 py-8 text-center text-sm">
          {format(t.noMatches, {
            q: query.trim() || (filters.find((f) => f.id === filter)?.label ?? ''),
          })}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">{t.colAstronaut}</TableHead>
                <TableHead>{t.colRole}</TableHead>
                <TableHead>{t.colStatus}</TableHead>
                <TableHead>{t.colLastPacket}</TableHead>
                <TableHead>{t.colWatch}</TableHead>
                <TableHead className="pr-4 text-right">
                  <span className="sr-only">{t.colActions}</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shown.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="pl-4">
                    <div className="flex items-center gap-3">
                      <Portrait id={m.id} name={m.name} size={28} />
                      <div className="flex min-w-0 flex-col">
                        {m.waiting ? (
                          <span className="truncate font-medium">{m.name}</span>
                        ) : (
                          <Link
                            href={`/astronaut/${encodeURIComponent(m.id)}`}
                            className="truncate font-medium hover:underline"
                          >
                            {m.name}
                          </Link>
                        )}
                        <span className="text-tertiary font-mono text-xs">{m.id}</span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className={m.role ? undefined : 'text-tertiary'}>
                    {m.role ?? '—'}
                  </TableCell>
                  <TableCell>
                    <StatusBadge waiting={m.waiting} signedIn={m.signedIn} t={t} />
                  </TableCell>
                  <TableCell className="text-muted-foreground tabular-nums">
                    {m.lastPacketAt ? format(t.agoShort, { t: ago(m.lastPacketAt, now) }) : '—'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {m.hasWatch ? (
                      <span className="inline-flex items-center gap-1.5">
                        <Watch aria-hidden="true" className="size-3.5" />
                        {t.watchYes}
                      </span>
                    ) : (
                      <span className="text-tertiary">—</span>
                    )}
                  </TableCell>
                  <TableCell className="pr-4">
                    {readOnly ? null : (
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant={m.waiting ? 'outline' : 'ghost'}
                          size="sm"
                          aria-label={format(t.inviteQrLabel, { name: m.name })}
                          onClick={() => setPanel({ kind: 'invite', id: m.id })}
                        >
                          <QrCode data-icon="inline-start" />
                          {t.inviteQr}
                        </Button>
                        <RowMenu
                          member={m}
                          lang={lang}
                          onEdit={() => setPanel({ kind: 'edit', id: m.id })}
                          onRemove={() => setPanel({ kind: 'remove', id: m.id })}
                        />
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Sheet open={panel !== null} onOpenChange={(open) => (open ? null : close())}>
        <SheetContent
          side="right"
          className="gap-5 overflow-y-auto p-5 data-[side=right]:w-full data-[side=right]:sm:max-w-[440px]"
        >
          {panel?.kind === 'add' ? (
            <AddPanel
              mission={mission}
              t={t}
              onCancel={close}
              onAdded={(id, name) => {
                toast.success(format(t.toastAdded, { name }));
                setPanel({ kind: 'invite', id });
              }}
            />
          ) : panel?.kind === 'edit' && panelMember ? (
            <EditPanel
              key={panelMember.id}
              mission={mission}
              member={panelMember}
              t={t}
              onCancel={close}
              onSaved={() => {
                toast.success(t.toastSaved, { description: panelMember.name });
                close();
              }}
            />
          ) : panel?.kind === 'remove' && panelMember ? (
            <RemovePanel
              key={panelMember.id}
              mission={mission}
              member={panelMember}
              t={t}
              onCancel={close}
              onDone={close}
            />
          ) : panel?.kind === 'invite' && panelMember ? (
            <InvitePanel
              mission={mission}
              earthUrl={earthUrl}
              member={panelMember}
              lang={lang}
              onClose={close}
            />
          ) : panel ? (
            <div className="text-muted-foreground flex items-center gap-2 pt-8 text-sm">
              <LoaderCircle
                aria-hidden="true"
                className="size-4 animate-spin motion-reduce:animate-none"
              />
              <SheetTitle className="text-sm font-normal">{t.rosterAdd}</SheetTitle>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </section>
  );
}

export function WaitingCrew({ members, lang }: { members: RosterMember[]; lang: Language }) {
  const t = texts[lang];
  if (!members.length) return null;
  return (
    <section aria-labelledby="crew-waiting-title" className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <h2 id="crew-waiting-title" className="text-sm font-semibold">
          {t.rosterWaitingTitle}
          <span className="text-tertiary ml-2 font-normal tabular-nums">{members.length}</span>
        </h2>
        <Link href="/crew" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
          <QrCode data-icon="inline-start" />
          {t.rosterManage}
        </Link>
      </div>
      <ul className="divide-border-subtle divide-y overflow-hidden rounded-xl border border-dashed">
        {members.map((m) => (
          <li key={m.id} className="flex min-h-11 items-center gap-3 px-4 py-1.5">
            <Portrait id={m.id} name={m.name} size={24} />
            <span className="min-w-0 flex-1 truncate text-sm">
              {m.name}
              {m.role ? <span className="text-muted-foreground"> · {m.role}</span> : null}
            </span>
            <span className="text-tertiary text-xs">
              {m.signedIn ? t.statusSignedIn : t.rosterWaiting}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
