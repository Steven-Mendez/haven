import { isTracked, loadConfig, unitLabel } from '@haven/core';
import { ChevronRight } from 'lucide-react';
import { TimeAgo } from '@/components/haven';
import { explain } from '@/components/haven/term';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { format, type Language, translate } from '@/lib/i18n';
import type { RulesVersion, StoredMission } from '@/server/types';
import type { ExtrasTexts } from '../i18n';
import { editableIndicators } from '../logic/rules';
import { agoText } from '../logic/time';
import { getBaseConfig, getCrewOverview, getCurrentConfig, listRules } from '../server';
import { crewDelivery, DeliveryBadge, memberDelivery } from './delivery-badge';
import { ExportJsonButton } from './export-buttons';
import { RulesTable } from './rules-table';

type Member = { id: string; name: string };

const VISIBLE_VERSIONS = 5;

type AuditEvent = { id: string; at: string; actor: string; text: string };

function auditEvents(versions: RulesVersion[], crew: Member[], t: ExtrasTexts) {
  const nameOf = (id: string) =>
    crew.find((m) => m.id === id)?.name ?? (id === 'phone' ? t.unknownPhone : id);
  const firstPerMember = (marks: { crewMember: string; at: string }[] = []) => {
    const first = new Map<string, string>();
    for (const m of [...marks].sort((x, y) => x.at.localeCompare(y.at)))
      if (!first.has(m.crewMember)) first.set(m.crewMember, m.at);
    return [...first.entries()];
  };
  const events: AuditEvent[] = versions.flatMap((v) => [
    {
      id: `${v.id}:sent`,
      at: v.sentAt,
      actor: v.author,
      text: format(t.eventSent, { version: v.version }),
    },
    ...firstPerMember(v.receivedBy).map(([member, at]) => ({
      id: `${v.id}:received:${member}`,
      at,
      actor: nameOf(member),
      text: format(t.eventReceived, { version: v.version }),
    })),
    ...(v.appliedBy ?? []).map((a, i) => ({
      id: `${v.id}:applied:${i}`,
      at: a.at,
      actor: nameOf(a.crewMember),
      text: format(t.eventApplied, { version: v.version }),
    })),
  ]);
  return events.sort((a, b) => Date.parse(b.at) - Date.parse(a.at)).slice(0, 60);
}

export async function RulesPanel({
  mission,
  lang,
  t,
}: {
  mission: StoredMission;
  lang: Language;
  t: ExtrasTexts;
}) {
  const [{ versions }, crewView] = await Promise.all([
    listRules(mission.code),
    getCrewOverview(mission.code),
  ]);
  const { config, fromVersion } = await getCurrentConfig(mission.code, versions);
  const nowIso = new Date().toISOString();
  const base = getBaseConfig();
  const crew: Member[] = (crewView?.crew ?? mission.crew).map((m) => ({ id: m.id, name: m.name }));
  const active =
    versions.find((v) => v.appliedBy.some((a) => crew.some((m) => m.id === a.crewMember))) ?? null;
  const environmentNames = Object.fromEntries(
    loadConfig().environments.map((e) => [e.id, translate(e.name, lang)]),
  );
  const audit = auditEvents(versions, crew, t);
  const crewIds = crew.map((m) => m.id);

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <RulesTable
        lang={lang}
        indicators={editableIndicators(config)
          .filter((i) => isTracked(i.id))
          .map((i) => ({ ...i, unit: unitLabel(i.unit, lang) }))}
        zones={loadConfig().zones.map((z) => ({ id: z.id, name: translate(z.name, lang) }))}
        currentVersion={fromVersion?.version ?? config.version}
        environmentNames={environmentNames}
        explanations={Object.fromEntries(
          editableIndicators(config).map((i) => [i.id, explain(i.id, lang)]),
        )}
      />
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <section aria-labelledby="versions" className="flex flex-col gap-2">
          <div className="flex flex-col gap-0.5">
            <h2 id="versions" className="text-sm font-semibold">
              {t.versionsTitle}
            </h2>
            <p className="text-muted-foreground text-xs">{t.versionsDescription}</p>
          </div>
          <ul
            className="divide-border-subtle flex flex-col divide-y overflow-hidden rounded-xl border"
            data-testid="rules-versions"
          >
            {versions.slice(0, VISIBLE_VERSIONS).map((v) => versionRow(v))}
            {versions.length > VISIBLE_VERSIONS ? (
              <li>
                <Collapsible>
                  <CollapsibleTrigger className="text-muted-foreground hover:text-foreground hover:bg-hover flex h-9 w-full items-center gap-1 px-4 text-xs">
                    {format(t.seeAll, { n: versions.length })}
                    <ChevronRight aria-hidden="true" className="size-4" />
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <ul className="divide-border-subtle flex flex-col divide-y border-t">
                      {versions.slice(VISIBLE_VERSIONS).map((v) => versionRow(v))}
                    </ul>
                  </CollapsibleContent>
                </Collapsible>
              </li>
            ) : null}
            <li className="flex min-h-9 items-center gap-2 px-4 py-1.5 text-sm">
              <span className="font-mono text-xs">{base.version}</span>
              <span className="text-muted-foreground truncate" title={t.baseVersionDetail}>
                {t.baseVersion}
              </span>
              {active ? null : (
                <Badge variant="secondary" className="ml-auto" title={t.activeHint}>
                  {t.active}
                </Badge>
              )}
            </li>
          </ul>
        </section>

        <div className="flex min-w-0 flex-col gap-4">
          <Accordion multiple className="rounded-xl border px-4">
            <AccordionItem value="delivery">
              <AccordionTrigger className="min-h-11 items-center">
                <span className="flex flex-col gap-0.5">
                  {t.deliveryTitle}
                  <span className="text-muted-foreground text-xs font-normal">
                    {t.deliveryDescription}
                  </span>
                </span>
              </AccordionTrigger>
              <AccordionContent className="pb-4">
                {versions.length === 0 ? (
                  <p className="text-muted-foreground">
                    {t.noVersions} · {format(t.noVersionsDetail, { version: base.version })}
                  </p>
                ) : (
                  <Table data-testid="rules-delivery">
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t.version}</TableHead>
                        <TableHead>{t.sentAt}</TableHead>
                        {crew.length ? (
                          crew.map((m) => <TableHead key={m.id}>{m.name}</TableHead>)
                        ) : (
                          <TableHead>{t.noCrew}</TableHead>
                        )}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {versions.map((v) => (
                        <TableRow key={v.id}>
                          <TableCell className="numeric font-medium">{v.version}</TableCell>
                          <TableCell>
                            <TimeAgo at={v.sentAt} lang={lang} className="text-muted-foreground">
                              {agoText(v.sentAt, nowIso, t)}
                            </TimeAgo>
                          </TableCell>
                          {crew.length ? (
                            crew.map((m) => {
                              const d = memberDelivery(v, m.id);
                              return (
                                <TableCell key={m.id}>
                                  {d.at ? (
                                    <TimeAgo at={d.at} lang={lang}>
                                      <DeliveryBadge status={d.status} lang={lang} t={t} />
                                    </TimeAgo>
                                  ) : (
                                    <DeliveryBadge status={d.status} lang={lang} t={t} />
                                  )}
                                </TableCell>
                              );
                            })
                          ) : (
                            <TableCell>
                              <DeliveryBadge {...crewDelivery(v, crewIds)} lang={lang} t={t} />
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="audit">
              <AccordionTrigger className="min-h-11 items-center">
                <span className="flex flex-col gap-0.5">
                  {format(t.auditCount, { n: audit.length })}
                  <span className="text-muted-foreground text-xs font-normal">
                    {t.auditDescription}
                  </span>
                </span>
              </AccordionTrigger>
              <AccordionContent className="pb-4">
                {audit.length === 0 ? (
                  <p className="text-muted-foreground">{t.noAudit}</p>
                ) : (
                  <Table data-testid="rules-audit">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-32">{t.date}</TableHead>
                        <TableHead className="w-40">{t.actor}</TableHead>
                        <TableHead>{t.event}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {audit.map((e) => (
                        <TableRow key={e.id}>
                          <TableCell className="text-muted-foreground">
                            <TimeAgo at={e.at} lang={lang}>
                              {agoText(e.at, nowIso, t)}
                            </TimeAgo>
                          </TableCell>
                          <TableCell>{e.actor}</TableCell>
                          <TableCell>{e.text}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </div>
    </div>
  );

  function versionRow(v: RulesVersion) {
    return (
      <li
        key={v.id}
        className="flex min-h-9 flex-wrap items-center gap-x-2 gap-y-1 px-4 py-1.5 text-sm"
        data-version={v.version}
        title={[v.note, format(t.sentBy, { author: v.author })].filter(Boolean).join(' · ')}
      >
        <span className="font-mono text-xs">{v.version}</span>
        {active?.id === v.id ? (
          <Badge variant="secondary" title={t.activeHint}>
            {t.active}
          </Badge>
        ) : null}
        <span className="ml-auto flex items-center gap-2">
          <TimeAgo at={v.sentAt} lang={lang} className="text-muted-foreground text-xs tabular-nums">
            {agoText(v.sentAt, nowIso, t)}
          </TimeAgo>
          <DeliveryBadge {...crewDelivery(v, crewIds)} lang={lang} t={t} />
          <ExportJsonButton
            versionId={v.id}
            filename={`haven-rules-${mission.code}-${v.version}.json`}
            labels={{ idle: t.exportJson, busy: t.exporting, failed: t.exportFailed }}
            iconOnly
          />
        </span>
      </li>
    );
  }
}
