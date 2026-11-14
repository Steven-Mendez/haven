import { CheckCheck, Inbox, Send } from 'lucide-react';
import { LevelBadge } from '@/components/haven';
import { Badge } from '@/components/ui/badge';
import { format, type Language } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { DeliveryStatus, RulesVersion } from '@/server/types';
import type { ExtrasTexts } from '../i18n';

export type CrewDelivery = {
  status: DeliveryStatus;
  /** Crew members at this stage (received counts those who applied too); `undefined` if unknown. */
  count?: number;
  total: number;
};

type Mark = { crewMember: string };

/**
 * Delivery of a version across the crew: sent (created on Earth) → received on board n/total (each
 * phone downloaded it, `receivedBy`) → applied n/total (`appliedBy`). Only crew members of the
 * mission count; anonymous or unknown marks are ignored here (the audit log still lists them).
 */
export function crewDelivery(
  v: Pick<RulesVersion, 'receivedBy' | 'appliedBy'>,
  crew: string[],
): CrewDelivery {
  const total = crew.length;
  const known = (marks: Mark[] = []) =>
    new Set(marks.map((m) => m.crewMember).filter((id) => crew.includes(id)));
  const applied = known(v.appliedBy);
  const received = new Set([...known(v.receivedBy), ...applied]);
  // Only crew members of the mission move the stage: an anonymous download ("phone") or an unknown
  // id never turns «Sent» into «Received».
  if (applied.size) return { status: 'applied', count: applied.size, total };
  if (received.size) return { status: 'received', count: received.size, total };
  return { status: 'sent', total };
}

/** One crew member's stage for a version. */
export function memberDelivery(v: Pick<RulesVersion, 'receivedBy' | 'appliedBy'>, id: string) {
  const applied = (v.appliedBy ?? []).find((m) => m.crewMember === id);
  if (applied) return { status: 'applied' as const, at: applied.at };
  const received = (v.receivedBy ?? []).find((m) => m.crewMember === id);
  if (received) return { status: 'received' as const, at: received.at };
  return { status: 'sent' as const, at: null };
}

/**
 * Delivery badge. «Applied» is green (●) only when every crew member applied it; partial stages are
 * neutral with their count. Not a health level, so only full application uses LevelBadge.
 */
export function DeliveryBadge({
  status,
  count,
  total,
  lang,
  t,
  className,
}: {
  status: DeliveryStatus;
  count?: number;
  total?: number;
  lang: Language;
  t: ExtrasTexts;
  className?: string;
}) {
  const ratio = count !== undefined && total ? ` ${format(t.ratio, { n: count, total })}` : '';
  if (status === 'applied' && (!total || (count !== undefined && count >= total)))
    return (
      <LevelBadge
        level="green"
        lang={lang}
        label={`${t.statusApplied}${ratio}`}
        prefix={false}
        size="sm"
        className={className}
      />
    );
  const Icon = status === 'sent' ? Send : status === 'applied' ? CheckCheck : Inbox;
  const label =
    status === 'sent' ? t.statusSent : status === 'applied' ? t.statusApplied : t.statusReceived;
  return (
    <Badge
      variant="outline"
      data-status={status}
      className={cn(
        'border-border text-muted-foreground h-6 gap-1.5 rounded-md bg-transparent px-2 text-xs font-medium',
        className,
      )}
    >
      <Icon aria-hidden="true" className="size-3" />
      <span className={status === 'sent' ? undefined : 'text-foreground'}>
        {label}
        {ratio}
      </span>
    </Badge>
  );
}
