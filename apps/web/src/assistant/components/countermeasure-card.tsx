'use client';

import { ArrowUpRight } from 'lucide-react';
import Link from 'next/link';
import { StatusPill } from '@/features/extras/components/panel-parts';
import type { AssistantTexts } from '../i18n';
import type { CountermeasureCardView } from '../types';

/** A countermeasure area in the chat: each crew member's state and a link to the tab. */
export function CountermeasureCard({
  card,
  t,
}: {
  card: CountermeasureCardView;
  t: AssistantTexts;
}) {
  return (
    <section
      aria-label={card.title}
      className="bg-card w-full overflow-hidden rounded-xl border shadow-xs"
      data-testid={`orion-countermeasure-${card.area}`}
    >
      <header className="bg-surface/60 flex items-center justify-between gap-3 border-b px-4 py-2">
        <h3 className="text-sm font-semibold">{card.title}</h3>
        <Link
          href={card.page}
          className="text-link inline-flex items-center gap-1 text-xs font-medium hover:underline"
        >
          {t.openTab}
          <ArrowUpRight aria-hidden="true" className="size-3.5" />
        </Link>
      </header>
      {card.rows.length === 0 ? (
        <p className="text-muted-foreground px-4 py-3 text-xs">{t.noCrewRows}</p>
      ) : (
        <ul className="divide-y">
          {card.rows.map((row) => (
            <li
              key={row.id}
              className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 py-2"
            >
              <span className="min-w-0 text-sm font-medium">{row.name}</span>
              <span className="flex flex-wrap items-center justify-end gap-2">
                {row.detail ? (
                  <span className="text-muted-foreground text-xs tabular-nums">{row.detail}</span>
                ) : null}
                <StatusPill tone={row.tone}>{row.label}</StatusPill>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
