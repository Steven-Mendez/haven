import 'server-only';
import {
  type Assessment,
  exercise,
  loadConfig,
  medications,
  missionDays,
  missionTemplates,
  sampleConfig,
  unitLabel,
} from '@haven/core';
import { tool } from 'ai';
import { z } from 'zod';
import { getAstronaut } from '@/features/astronaut/server';
import { earthUrlForPhones, getCrew, joinLink, joinQrSvg } from '@/features/crew/server';
import { texts as extrasTexts } from '@/features/extras/i18n';
import { loadKpiData } from '@/features/extras/kpi-data';
import { editableIndicators } from '@/features/extras/logic/rules';
import {
  getCurrentConfig,
  getEvaReadiness,
  getExerciseOverview,
  getMedicationOverview,
  getMotionOverview,
  getReentryReadiness,
  getSampleOverview,
  getWorkloadOverview,
  listMissions,
  listRules,
} from '@/features/extras/server';
import { LANGUAGES, translate } from '@/lib/i18n';
import {
  defaultDashboard,
  KPI_INDICATORS,
  KPI_PANEL_TYPES,
  KPI_RANGES,
  type KpiPanel,
} from '@/lib/kpi';
import type { CrewCard } from '@/server/types';
import type { AssistantContext, CountermeasureCardView, PanelView } from '../types';
import {
  commsCard,
  commsStatus,
  evaCard,
  exerciseCard,
  medicationCard,
  motionCard,
  reentryCard,
  samplesCard,
  workloadCard,
} from './countermeasures';
import { checkSeries, panelView, summarize } from './panels';
import { errorText, type Fail, fail, findCrew, findMission, NO_MISSION } from './shared';
import { createWriteTools, type WriteTools } from './writes';

const AREAS = [
  'eva',
  'reentry',
  'medication',
  'samples',
  'exercise',
  'motion',
  'workload',
  'comms',
] as const;

const AREA_PAGE: Record<(typeof AREAS)[number], string> = {
  eva: '/eva',
  reentry: '/reentry',
  medication: '/medication',
  samples: '/samples',
  exercise: '/exercise',
  motion: '/motion',
  workload: '/workload',
  comms: '/',
};
const CATALOGS = ['environments', 'templates', 'medications', 'samples', 'exercise'] as const;

const seriesSchema = z.object({
  indicator: z.string().describe('Chartable indicator id, e.g. heart-rate.'),
  source: z.string().optional().describe('"crew" for the crew mean (default) or a crew member id.'),
});

const clientResult = z.object({ ok: z.boolean(), message: z.string().optional() });

/** A read that failed tells the model why instead of breaking the turn. */
async function safely<T>(read: () => Promise<T | Fail>): Promise<T | Fail> {
  try {
    return await read();
  } catch (error) {
    console.error('[orion]', error);
    return fail(`Earth's database did not answer: ${errorText(error)}`);
  }
}

function fields<W extends WriteTools, F extends 'tool' | 'approval'>(writes: W, field: F) {
  return Object.fromEntries(Object.entries(writes).map(([name, w]) => [name, w[field]])) as {
    [K in keyof W]: W[K] extends Record<F, infer V> ? V : never;
  };
}

export function createAssistantTools(ctx: AssistantContext) {
  const { lang } = ctx;
  const et = extrasTexts[lang];
  const config = loadConfig();

  const assessment = (a: Assessment) => ({
    indicator: a.indicator,
    level: a.level,
    ...(a.value !== undefined ? { value: a.value } : {}),
    ...(a.baseline ? { baseline: a.baseline } : {}),
    explanation: translate(a.explanation, lang),
    actions: a.actions.map((action) => translate(action.text, lang)),
    ageMin: a.ageMin,
    ...(a.simulated ? { simulated: true } : {}),
  });

  const member = (m: CrewCard) => ({
    id: m.id,
    name: m.name,
    ...(m.role ? { role: translate(m.role, lang) } : {}),
    hasWatch: m.hasWatch,
    joined: Boolean(m.joinedAt),
    lastDataAt: m.lastDataAt,
    noRecentData: m.noRecentData,
    dailyActions: `${m.actionsDone}/${m.actionsTotal}`,
    zones: m.zones,
    alerts: m.alerts.map(assessment),
    emergency: m.emergency,
  });

  const kpiData = async (code: string | null) => {
    const found = await findMission(code);
    if (!found.ok) return found;
    const data = await loadKpiData({
      mission: found.mission.code,
      crew: found.mission.crew.map(({ id, name }) => ({ id, name })),
      lang,
      t: et,
    });
    return { ok: true as const, data };
  };

  const reads = {
    listMissions: tool({
      description:
        'The missions Earth follows, by name and status, to tell the operator which exist or to switch. The one marked active is the mission selected in the console: every other tool reads and changes only that one.',
      inputSchema: z.object({}),
      execute: () =>
        safely(async () => {
          const { missions } = await listMissions();
          return {
            activeMission: ctx.mission,
            missions: missions.map((m) => ({
              code: m.code,
              name: m.name,
              status: m.status,
              active: m.code === ctx.mission,
            })),
          };
        }),
    }),

    getCrewStatus: tool({
      description:
        'The active mission right now: day, phase, comms delay, and for each crew member the level of every zone, the open alerts with their explanation, the daily actions done and any open emergency. Start here for "how is the crew".',
      inputSchema: z.object({}),
      execute: () =>
        safely(async () => {
          if (!ctx.mission) return fail(NO_MISSION);
          const crew = await getCrew(ctx.mission);
          if (!crew) return fail(`Mission ${ctx.mission} does not exist.`);
          return {
            generatedAt: crew.generatedAt,
            mission: crew.mission,
            summary: crew.summary,
            zones: config.zones.map((z) => ({ id: z.id, name: translate(z.name, lang) })),
            crew: crew.crew.map(member),
          };
        }),
    }),

    getAstronaut: tool({
      description:
        'One crew member in detail: every current assessment from the rules engine (level, value, explanation, suggested actions) and the latest packets received with their notes.',
      inputSchema: z.object({
        crewMember: z.string().describe('Crew member id (preferred) or exact name.'),
      }),
      execute: ({ crewMember }) =>
        safely(async () => {
          const found = await findMission(ctx.mission);
          if (!found.ok) return found;
          const who = findCrew(found.mission, crewMember);
          if (!who.ok) return who;
          const detail = await getAstronaut(who.member.id, found.mission.code);
          if (!detail) return fail(`No data for ${who.member.name} yet.`);
          return {
            generatedAt: detail.generatedAt,
            crewMember: member(detail.crewMember),
            assessments: detail.assessments.map(assessment),
            packetsReceived: detail.packets.length,
            latestPackets: detail.packets.slice(0, 8).map((p) => ({
              id: p.id,
              type: p.type,
              sentAt: p.sentAt,
              visibleAt: p.visibleAt,
              readings: p.readings.length,
              ...(p.notes ? { notes: p.notes } : {}),
              ...(p.emergency ? { emergency: p.emergency } : {}),
            })),
            page: `/astronaut/${who.member.id}`,
          };
        }),
    }),

    getCountermeasures: tool({
      description:
        "One countermeasure area of the active mission, one row per crew member: eva (readiness for a spacewalk), reentry (preparation), medication (plan and adherence), samples (collections, pending lab results and loaded results), exercise (prescription and weekly compliance), motion (motion sickness and balance), workload (hours, fatigue, sleep) or comms (the link with the crew: live, delayed, autonomous or down, the one-way and round-trip delay and when something sent now reaches the crew). The chat draws a card with each crew member's state and a link to the tab.",
      inputSchema: z.object({ area: z.enum(AREAS) }),
      execute: ({ area }) =>
        safely(async () => {
          if (!ctx.mission) return fail(NO_MISSION);
          const mission = ctx.mission;
          const title =
            area === 'comms'
              ? et.commsTitle
              : {
                  eva: et.tabEva,
                  reentry: et.tabReentry,
                  medication: et.tabMedication,
                  samples: et.tabSamples,
                  exercise: et.tabExercise,
                  motion: et.tabMotion,
                  workload: et.tabWorkload,
                }[area];
          const card = (rows: CountermeasureCardView['rows']): CountermeasureCardView => ({
            area,
            title,
            page: AREA_PAGE[area],
            rows,
          });
          const missing = fail(`Mission ${mission} does not exist.`);
          switch (area) {
            case 'comms': {
              const found = await findMission(mission);
              if (!found.ok) return found;
              const status = commsStatus(found.mission, new Date());
              return { area, ...status, card: card(commsCard(found.mission, status, lang)) };
            }
            case 'eva': {
              const r = await getEvaReadiness(mission);
              return r ? { area, ...r, card: card(evaCard(r.rows, et)) } : missing;
            }
            case 'reentry': {
              const r = await getReentryReadiness(mission);
              return r ? { area, ...r, card: card(reentryCard(r.rows, et)) } : missing;
            }
            case 'medication': {
              const r = await getMedicationOverview(mission);
              return r ? { area, ...r, card: card(medicationCard(r.rows, et)) } : missing;
            }
            case 'exercise': {
              const r = await getExerciseOverview(mission);
              return r ? { area, ...r, card: card(exerciseCard(r.rows, et)) } : missing;
            }
            case 'motion': {
              const r = await getMotionOverview(mission);
              return r ? { area, ...r, card: card(motionCard(r.rows, et)) } : missing;
            }
            case 'workload': {
              const r = await getWorkloadOverview(mission);
              return r ? { area, ...r, card: card(workloadCard(r.rows, et)) } : missing;
            }
            case 'samples': {
              const r = await getSampleOverview(mission);
              return r
                ? {
                    area,
                    ...r,
                    results: r.results.slice(0, 20),
                    card: card(samplesCard(r.rows, et)),
                  }
                : missing;
            }
          }
        }),
      // The card is for the operator; the model reads the data without it.
      toModelOutput: ({ output }) => {
        if ('error' in output) return { type: 'error-text', value: output.error };
        const { card: _card, ...data } = output;
        return { type: 'json', value: { ...data, cardShown: true } };
      },
    }),

    listIndicators: tool({
      description:
        'The indicators the rules engine evaluates, with their unit, zone, current green range and the amber/red rules whose ranges Earth can edit, plus the latest rules versions sent and whether the crew received and applied them. "chartable" marks the ones showPanel and getStatistics accept.',
      inputSchema: z.object({}),
      execute: () =>
        safely(async () => {
          const versions = ctx.mission ? (await listRules(ctx.mission)).versions : [];
          const current = ctx.mission
            ? (await getCurrentConfig(ctx.mission, versions)).config
            : config;
          const editable = new Map(editableIndicators(current).map((i) => [i.id, i]));
          return {
            rulesVersion: current.version,
            indicators: current.indicators.map((i) => ({
              id: i.id,
              name: translate(i.name, lang),
              unit: unitLabel(i.unit, lang),
              zone: i.zone,
              kind: i.kind,
              chartable: KPI_INDICATORS.includes(i.id),
              ...(editable.has(i.id)
                ? {
                    green: editable.get(i.id)?.green,
                    rules: editable.get(i.id)?.rules.map((r) => ({
                      index: r.index,
                      level: r.level,
                      outside: r.outside,
                    })),
                  }
                : {}),
            })),
            versionsSent: versions.slice(0, 6).map((v) => ({
              version: v.version,
              note: v.note,
              author: v.author,
              sentAt: v.sentAt,
              status: v.status,
              receivedBy: v.receivedBy.map((r) => r.crewMember),
              appliedBy: v.appliedBy.map((r) => r.crewMember),
            })),
          };
        }),
    }),

    getStatistics: tool({
      description:
        'Numbers for a report: for each series, the daily means over a period summarized as first, last, min, max, mean, change and days outside the green range. Nothing is drawn; use showPanel when the operator should see it.',
      inputSchema: z.object({
        series: z.array(seriesSchema).min(1).max(24),
        range: z
          .enum(KPI_RANGES)
          .optional()
          .describe('Period ending on the latest day with data. Default 30d.'),
        dailyValues: z.boolean().optional().describe('true to also get every daily value.'),
      }),
      execute: ({ series, range, dailyValues }) =>
        safely(async () => {
          const loaded = await kpiData(ctx.mission);
          if (!loaded.ok) return loaded;
          // A table takes five series; a report may want more, so summarize in groups.
          const groups: PanelView[] = [];
          for (let i = 0; i < series.length; i += 5) {
            const group = checkSeries(loaded.data, 'table', series.slice(i, i + 5));
            if (!group.ok) return group;
            const panel: KpiPanel = { id: `stats-${i}`, type: 'table', series: group.series };
            groups.push(panelView(loaded.data, panel, range ?? '30d'));
          }
          const parts = groups.map((view) => summarize(view, { dailyValues }));
          return { period: parts[0]?.period, series: parts.flatMap((p) => p.series) };
        }),
    }),

    showPanel: tool({
      description:
        'Draws a panel in the chat for the operator, with the same components as the KPI page: timeseries (lines over time), bars (daily bars), stat (latest value and change), gauge (latest value against the green range) or table (statistics per series). A chart shares one axis, so its series need the same unit; compare crew members by repeating the indicator with different sources. You receive the statistics of what was drawn.',
      inputSchema: z.object({
        type: z.enum(KPI_PANEL_TYPES),
        series: z.array(seriesSchema).min(1).max(5),
        range: z
          .enum(KPI_RANGES)
          .optional()
          .describe('Period ending on the latest day with data. Default 30d.'),
        title: z.string().max(80).optional(),
      }),
      execute: ({ type, series, range, title }) =>
        safely(async () => {
          const loaded = await kpiData(ctx.mission);
          if (!loaded.ok) return loaded;
          const checked = checkSeries(loaded.data, type, series);
          if (!checked.ok) return checked;
          const panel: KpiPanel = {
            id: 'chat',
            type,
            ...(title?.trim() ? { title: title.trim() } : {}),
            series: checked.series,
            reference: true,
            ...(type === 'timeseries' ? { markers: true } : {}),
          };
          return { ok: true as const, view: panelView(loaded.data, panel, range ?? '30d') };
        }),
      toModelOutput: ({ output }) =>
        'view' in output
          ? { type: 'json', value: { shown: true, ...summarize(output.view) } }
          : { type: 'error-text', value: output.error },
    }),

    showKpiDashboard: tool({
      description:
        "Draws the mission's whole KPI dashboard in the chat, panel by panel, like the /kpi page (the saved dashboard, or the default one). Use it when the operator asks for the KPIs in general; for one indicator use showPanel. You receive the statistics of every panel.",
      inputSchema: z.object({
        range: z
          .enum(KPI_RANGES)
          .optional()
          .describe("Period for every panel; the dashboard's own when omitted."),
      }),
      execute: ({ range }) =>
        safely(async () => {
          const loaded = await kpiData(ctx.mission);
          if (!loaded.ok) return loaded;
          if (loaded.data.withData.length === 0)
            return fail(
              'No indicator has data yet: the crew has not sent readings for this mission.',
            );
          const dashboard = loaded.data.saved ?? defaultDashboard(loaded.data.withData);
          return {
            ok: true as const,
            views: dashboard.panels
              .slice(0, 12)
              .map((panel) =>
                panelView(loaded.data, panel, range ?? panel.range ?? dashboard.range),
              ),
          };
        }),
      toModelOutput: ({ output }) =>
        'views' in output
          ? {
              type: 'json',
              value: {
                shown: true,
                panels: output.views.map((view) => ({
                  type: view.panel.type,
                  ...(view.panel.title ? { title: view.panel.title } : {}),
                  ...summarize(view),
                })),
              },
            }
          : { type: 'error-text', value: output.error },
    }),

    showChart: tool({
      description:
        'Builds a chart the console does not have, in the chat, from numbers you already got from other tools: getStatistics with dailyValues (daily means), getReadings (individual readings of any indicator) or the countermeasure tools (adherence, hours, compliance, counts). Types: "bars" compares categories (several series are grouped; stacked for parts of a whole; horizontal for long labels or rankings), "lines" follows an ordered sequence such as days or hours, "area" is lines with the volume shaded (stack it for a total made of parts), "scatter" relates two measures through [x, y] points, and "donut" shows the shares of one whole (at most five slices; use it when the operator asks for a pie or donut, otherwise prefer bars). Every series shares one unit: one value per category, or points for a scatter. Add reference to mark a range or a limit, such as the green range of an indicator.',
      inputSchema: z.object({
        type: z.enum(['bars', 'lines', 'area', 'scatter', 'donut']),
        title: z.string().min(1).max(80),
        categories: z
          .array(z.string().min(1).max(40))
          .max(120)
          .optional()
          .describe(
            'Labels along the x axis (crew members, days, hours…) or the slices of a donut. Not for a scatter.',
          ),
        series: z
          .array(
            z.object({
              name: z.string().min(1).max(40),
              values: z
                .array(z.number().nullable())
                .optional()
                .describe('One per category; null where unknown.'),
              points: z
                .array(z.array(z.number()).length(2))
                .max(300)
                .optional()
                .describe('Scatter only: [x, y] pairs.'),
            }),
          )
          .min(1)
          .max(5),
        unit: z.string().max(16).optional().describe('Unit of the values, e.g. %, h, lpm.'),
        xLabel: z
          .string()
          .max(40)
          .optional()
          .describe('Scatter only: what x measures, with its unit.'),
        stacked: z.boolean().optional().describe('Bars and area: stack the series.'),
        horizontal: z.boolean().optional().describe('Bars only: categories down the side.'),
        reference: z
          .object({ from: z.number(), to: z.number() })
          .optional()
          .describe('A band on the value axis, or a line when from equals to.'),
      }),
      execute: async (input) => {
        const { type } = input;
        if (type === 'scatter') {
          const empty = input.series.find((s) => !s.points?.length);
          if (empty) return fail(`"${empty.name}" needs points: [x, y] pairs.`);
          return {
            ok: true as const,
            chart: {
              type,
              title: input.title,
              categories: [],
              series: input.series.map((s) => ({
                name: s.name,
                values: [],
                points: (s.points ?? []).map((p) => [p[0] ?? 0, p[1] ?? 0] as [number, number]),
              })),
              ...(input.unit ? { unit: input.unit } : {}),
              ...(input.xLabel ? { xLabel: input.xLabel } : {}),
              ...(input.reference ? { reference: input.reference } : {}),
            },
          };
        }
        let categories = input.categories ?? [];
        if (categories.length === 0) return fail('Give the categories: one label per value.');
        let series = input.series.map((s) => ({ name: s.name, values: s.values ?? [] }));
        const uneven = series.find((s) => s.values.length !== categories.length);
        if (uneven)
          return fail(
            `"${uneven.name}" has ${uneven.values.length} values for ${categories.length} categories: give one per category.`,
          );
        if (series.every((s) => s.values.every((v) => v === null)))
          return fail('There is no number to draw.');
        if (type === 'donut') {
          const only = series[0];
          if (series.length !== 1 || !only)
            return fail('A donut shows one series: the shares of one whole.');
          if (only.values.some((v) => (v ?? 0) < 0))
            return fail('A donut cannot show negative values.');
          // Five hues are told apart reliably: the smallest slices fold into one.
          const slices = categories
            .map((name, i) => ({ name, value: only.values[i] ?? 0 }))
            .filter((slice) => slice.value > 0)
            .sort((a, b) => b.value - a.value);
          if (slices.length < 2)
            return fail(
              'A donut needs at least two parts above zero; show a single number in text.',
            );
          const kept = slices.length > 5 ? slices.slice(0, 4) : slices;
          const rest = slices.slice(kept.length).reduce((sum, slice) => sum + slice.value, 0);
          const folded =
            rest > 0 ? [...kept, { name: lang === 'es' ? 'Otros' : 'Other', value: rest }] : kept;
          categories = folded.map((slice) => slice.name);
          series = [{ name: only.name, values: folded.map((slice) => slice.value) }];
        }
        return {
          ok: true as const,
          chart: {
            type,
            title: input.title,
            categories,
            series,
            ...(input.unit ? { unit: input.unit } : {}),
            ...((type === 'bars' || type === 'area') && input.stacked ? { stacked: true } : {}),
            ...(type === 'bars' && input.horizontal ? { horizontal: true } : {}),
            ...(input.reference && type !== 'donut' ? { reference: input.reference } : {}),
          },
        };
      },
      toModelOutput: ({ output }) =>
        'chart' in output
          ? { type: 'json', value: { shown: true } }
          : { type: 'error-text', value: output.error },
    }),

    getReadings: tool({
      description:
        'The individual readings of one crew member, as [ISO time, value] pairs, for any numeric indicator (not only the chartable ones) over the last hours or days. Daily means hide what happens within a day: use this to chart one day hour by hour, to relate two indicators, or for an indicator the KPI views do not plot. Long series are thinned to about 120 evenly spaced points.',
      inputSchema: z.object({
        crewMember: z.string().describe('Crew member id (preferred) or exact name.'),
        indicators: z
          .array(z.string())
          .min(1)
          .max(6)
          .describe('Indicator ids from listIndicators.'),
        sinceHours: z
          .number()
          .int()
          .min(1)
          .max(24 * 90)
          .optional()
          .describe('How far back from now. Default 72.'),
      }),
      execute: ({ crewMember, indicators, sinceHours }) =>
        safely(async () => {
          const found = await findMission(ctx.mission);
          if (!found.ok) return found;
          const who = findCrew(found.mission, crewMember);
          if (!who.ok) return who;
          const detail = await getAstronaut(who.member.id, found.mission.code);
          if (!detail) return fail(`No data for ${who.member.name} yet.`);
          const from = Date.parse(detail.generatedAt) - (sinceHours ?? 72) * 3_600_000;
          const known = new Map(config.indicators.map((i) => [i.id, i]));
          return {
            crewMember: { id: who.member.id, name: who.member.name },
            since: new Date(from).toISOString(),
            series: indicators.map((id) => {
              const all = (detail.series[id] ?? []).filter(([at]) => at >= from);
              const step = Math.max(1, Math.ceil(all.length / 120));
              const info = known.get(id);
              return {
                indicator: id,
                name: info ? translate(info.name, lang) : id,
                unit: info ? unitLabel(info.unit, lang) : '',
                ...(info?.green ? { greenRange: info.green } : {}),
                readings: all.length,
                points: all
                  .filter((_, index) => index % step === 0 || index === all.length - 1)
                  .map(([at, value]) => [new Date(at).toISOString(), value] as const),
              };
            }),
            ...(Object.keys(detail.series).length
              ? { indicatorsWithReadings: Object.keys(detail.series) }
              : {}),
          };
        }),
    }),

    getKpiDashboard: tool({
      description:
        "The mission's saved KPI dashboard (the /kpi page): its period and panels with their ids. Needed before editKpiDashboard.",
      inputSchema: z.object({}),
      execute: () =>
        safely(async () => {
          const loaded = await kpiData(ctx.mission);
          if (!loaded.ok) return loaded;
          const dashboard = loaded.data.saved ?? defaultDashboard(loaded.data.withData);
          return {
            customized: Boolean(loaded.data.saved),
            range: dashboard.range,
            panels: dashboard.panels,
            sources: loaded.data.sources,
            indicatorsWithData: loaded.data.withData,
          };
        }),
    }),

    getCatalog: tool({
      description:
        'Reference lists from the versioned configuration: environments and mission templates (to plan a mission), medications (to build a plan), samples (types and analytes) or exercise (default prescription and limits).',
      inputSchema: z.object({ kind: z.enum(CATALOGS) }),
      execute: async ({ kind }) => {
        if (kind === 'environments')
          return {
            environments: config.environments.map((e) => ({
              id: e.id,
              name: translate(e.name, lang),
              gravity: e.gravity,
              delayMin: e.delayMin,
              delayMax: e.delayMax,
              ...(e.description ? { description: translate(e.description, lang) } : {}),
            })),
          };
        if (kind === 'templates')
          return {
            templates: missionTemplates.map((m) => ({
              id: m.id,
              name: translate(m.name, lang),
              description: translate(m.description, lang),
              days: missionDays(m.phases),
              phases: m.phases,
            })),
          };
        if (kind === 'medications')
          return {
            medications: medications.catalog.map((m) => ({
              id: m.id,
              name: translate(m.name, lang),
              purpose: translate(m.purpose, lang),
              instructions: translate(m.instructions, lang),
              schedule: m.schedule,
            })),
          };
        if (kind === 'samples')
          return {
            samples: sampleConfig.samples.map((s) => ({
              id: s.id,
              name: translate(s.name, lang),
              everyDays: s.everyDays,
              analytes: s.analytes,
            })),
          };
        return { exercise: { prescription: exercise.prescription, limits: exercise.limits } };
      },
    }),

    getInvitation: tool({
      description:
        'The invitation a crew member of the active mission opens on their phone to join it: a link, shown to the operator with its QR code.',
      inputSchema: z.object({
        crewMember: z.string().describe('Crew member id (preferred) or exact name.'),
      }),
      execute: ({ crewMember }) =>
        safely(async () => {
          const found = await findMission(ctx.mission);
          if (!found.ok) return found;
          const who = findCrew(found.mission, crewMember);
          if (!who.ok) return who;
          const link = joinLink(found.mission.code, who.member.id, await earthUrlForPhones());
          return {
            ok: true as const,
            name: who.member.name,
            mission: found.mission.code,
            link,
            qrSvg: await joinQrSvg(link),
          };
        }),
      toModelOutput: ({ output }) =>
        'link' in output
          ? {
              type: 'json',
              value: { shown: true, name: output.name, mission: output.mission, link: output.link },
            }
          : { type: 'error-text', value: output.error },
    }),

    // The next four run in the operator's browser: they change what this
    // operator sees (a cookie or the page), never mission data.
    switchMission: tool({
      description:
        'Asks the operator to make another mission the active one, like the mission switcher in the sidebar: they see a card and confirm or decline. Only when they ask to change mission, never to look something up in another one.',
      inputSchema: z.object({
        code: z
          .string()
          .regex(/^[A-Za-z0-9]{6}$/)
          .describe('Mission code.'),
      }),
      outputSchema: clientResult,
    }),

    openPage: tool({
      description:
        'Takes the operator to a page of the Ground View: / (crew), /astronaut/<id>, /rules, /rules/<indicator> (threshold editor), /kpi, /kpi?view=individual&indicator=<id>, /eva, /motion, /reentry, /medication, /samples, /exercise, /workload, /missions, /missions/new, /missions/<code>, /missions/<code>/plan, /crew (manage crew), /settings. The chat is left behind, so do it last and only when asked to open or go somewhere.',
      inputSchema: z.object({
        path: z
          .string()
          // The browser refuses anything that is not a path of this site before navigating.
          .startsWith('/')
          .max(200),
      }),
      outputSchema: clientResult,
    }),

    setLanguage: tool({
      description: 'Changes the language of the Ground View for this operator.',
      inputSchema: z.object({ language: z.enum(LANGUAGES as [string, ...string[]]) }),
      outputSchema: clientResult,
    }),

    setTheme: tool({
      description: 'Switches the Ground View between the dark and the light theme.',
      inputSchema: z.object({ theme: z.enum(['dark', 'light']) }),
      outputSchema: clientResult,
    }),
  };

  const writes = createWriteTools(ctx);
  return {
    tools: { ...reads, ...fields(writes, 'tool') },
    /** Every change waits for the operator, who sees the plan the server computed. */
    toolApproval: fields(writes, 'approval'),
  };
}
