import 'server-only';
import {
  classifySample,
  cleanAssignments,
  cleanPrescription,
  exercise,
  loadConfig,
  type MissionPhase,
  medications,
  missionDays,
  missionTemplates,
  prescriptionOf,
  sampleConfig,
} from '@haven/core';
import { type ToolApprovalStatus, tool } from 'ai';
import { z } from 'zod';
import { addCrewMember, removeCrewMember, updateCrewMember } from '@/features/crew/server';
import { texts as extrasTexts } from '@/features/extras/i18n';
import { loadKpiData } from '@/features/extras/kpi-data';
import { addPanel, panelId, removePanel, updatePanel } from '@/features/extras/logic/kpi';
import { templatePhases } from '@/features/extras/logic/plan-options';
import {
  applyEdit,
  engineCheck,
  type Range,
  type RulesEdit,
  validateEdit,
} from '@/features/extras/logic/rules';
import {
  createMission,
  finishMission,
  getBaseConfig,
  getCrewPlan,
  getCurrentConfig,
  getSampleOverview,
  listRules,
  saveExercisePrescription,
  saveKpiDashboardFor,
  saveMedicationPlan,
  saveRules,
  saveSampleResult,
  startMission,
  updateMission,
} from '@/features/extras/server';
import { translate } from '@/lib/i18n';
import {
  defaultDashboard,
  KPI_PANEL_TYPES,
  KPI_RANGES,
  type KpiDashboard,
  type KpiPanel,
  validateDashboard,
} from '@/lib/kpi';
import type { AssistantContext, WriteResult } from '../types';
import { checkSeries } from './panels';
import { errorText, type Fail, fail, findCrew, findMission, pick } from './shared';

/** What a change will do, in words for the operator, and how to do it once they agree. */
type Plan = Fail | { ok: true; lines: string[]; run: () => Promise<WriteResult> };

/**
 * A tool that changes something. The same plan feeds the confirmation card and
 * the execution, so what the operator approves is what runs; a plan that cannot
 * run is refused before anyone is asked.
 */
function writeTool<S extends z.ZodType>(def: {
  description: string;
  inputSchema: S;
  plan: (input: z.infer<S>) => Promise<Plan>;
}) {
  const safePlan = async (input: z.infer<S>): Promise<Plan> => {
    try {
      return await def.plan(input);
    } catch (error) {
      console.error('[orion]', error);
      return fail(`Earth's database did not answer: ${errorText(error)}`);
    }
  };
  return {
    tool: tool({
      description: def.description,
      inputSchema: def.inputSchema as z.ZodType<z.infer<S>>,
      execute: async (input: z.infer<S>): Promise<WriteResult> => {
        const plan = await safePlan(input);
        if (!plan.ok) return plan;
        try {
          return await plan.run();
        } catch (error) {
          console.error('[orion]', error);
          return fail(`Earth's database did not answer: ${errorText(error)}`);
        }
      },
    }),
    approval: async (input: z.infer<S>): Promise<ToolApprovalStatus> => {
      const plan = await safePlan(input);
      return plan.ok
        ? { type: 'user-approval', reason: plan.lines.join('\n') }
        : { type: 'denied', reason: plan.error };
    },
  };
}

const crewRef = z.string().min(1).max(60).describe('Crew member id (preferred) or exact name.');

const rangeSchema = z.array(z.number()).length(2).describe('[min, max]');

const phaseSchema = z.object({
  environment: z.string().describe('Environment id from getCatalog("environments").'),
  days: z.number().int().min(1).max(3000),
  delayMin: z
    .number()
    .min(0)
    .optional()
    .describe("One-way comms delay in minutes; the environment's own when omitted."),
  label: z.object({ es: z.string().max(80), en: z.string().max(80) }).optional(),
});

const scheduleSchema = z.union([
  z.object({ kind: z.literal('daily'), times: z.array(z.string()).min(1) }),
  z.object({
    kind: z.literal('weekly'),
    weekday: z.number().int().min(0).max(6).describe('0 is Sunday.'),
    times: z.array(z.string()).min(1),
  }),
  z.object({ kind: z.literal('as-needed'), maxPerDay: z.number().int().min(1) }),
]);

const seriesSchema = z.object({
  indicator: z.string().describe('Chartable indicator id, e.g. heart-rate.'),
  source: z.string().optional().describe('"crew" for the crew mean (default) or a crew member id.'),
});

const range = ([a, b]: readonly [number, number]) => `${a}–${b}`;
const sameRange = (a: readonly [number, number], b: readonly [number, number]) =>
  a[0] === b[0] && a[1] === b[1];

export function createWriteTools(ctx: AssistantContext) {
  const { lang, author } = ctx;
  const L = pick(lang);
  const config = loadConfig();
  const environments = new Map(config.environments.map((e) => [e.id, e]));
  const phasesText = (phases: MissionPhase[]) =>
    phases
      .map(
        (p) =>
          `${translate(environments.get(p.environment)?.name, lang) || p.environment} ${p.days} d`,
      )
      .join(' → ');
  const unknownEnvironment = (phases: MissionPhase[]) =>
    phases.find((p) => !environments.has(p.environment))?.environment;
  const done = (summary: string): WriteResult => ({ ok: true, summary });
  const failed = (result: { error: string; details?: string[] }): WriteResult =>
    fail([result.error, ...(result.details ?? [])].join(' · '));

  return {
    updateThresholds: writeTool({
      description:
        'Changes the thresholds of one numeric indicator (its green range and the ranges outside which a rule turns amber or red) and sends them to the crew as a new rules version. Read the current ranges with listIndicators first. Every amber/red range must contain the green one.',
      inputSchema: z.object({
        indicator: z.string().describe('Indicator id.'),
        green: rangeSchema
          .optional()
          .describe('New green range [min, max]; unchanged when omitted.'),
        rules: z
          .array(
            z.object({
              index: z.number().int().min(0).describe('Rule index from listIndicators.'),
              outside: rangeSchema,
            }),
          )
          .optional()
          .describe('Rules whose "outside" range changes; the rest stay as they are.'),
        note: z.string().max(500).optional().describe('Why, for the version history.'),
      }),
      plan: async (input) => {
        const found = await findMission(ctx.mission);
        if (!found.ok) return found;
        const mission = found.mission.code;
        const { versions } = await listRules(mission);
        const { config: current } = await getCurrentConfig(mission, versions);
        const indicator = current.indicators.find((i) => i.id === input.indicator);
        if (indicator?.kind !== 'number')
          return fail(
            `"${input.indicator}" is not a numeric indicator. Call listIndicators for the ids with editable thresholds.`,
          );

        const wanted = new Map((input.rules ?? []).map((r) => [r.index, r.outside as Range]));
        for (const index of wanted.keys())
          if (!indicator.rules[index]?.outside)
            return fail(`Rule ${index} of ${indicator.id} has no "outside" range to change.`);
        const edit: RulesEdit = {
          indicator: indicator.id,
          green: (input.green as Range | undefined) ?? [indicator.green[0], indicator.green[1]],
          outside: {},
        };
        indicator.rules.forEach((r, index) => {
          if (r.outside) edit.outside[index] = wanted.get(index) ?? [r.outside[0], r.outside[1]];
        });

        const problems = validateEdit(indicator, edit);
        if (problems.length)
          return fail(
            problems
              .map((p) =>
                p.code === 'contains'
                  ? `${p.field}: the range must contain the green range ${range(edit.green)}; widen it in the same call.`
                  : p.code === 'order'
                    ? `${p.field}: min is above max.`
                    : `${p.field}: not a valid number.`,
              )
              .join(' '),
          );

        const name = translate(indicator.name, lang);
        const changes: string[] = [];
        if (!sameRange(indicator.green, edit.green))
          changes.push(
            `${L('Verde', 'Green')}: ${range(indicator.green)} → ${range(edit.green)} ${indicator.unit}`,
          );
        indicator.rules.forEach((r, index) => {
          const next = edit.outside[index];
          if (!r.outside || !next || sameRange(r.outside, next)) return;
          const level = r.level === 'red' ? L('Rojo', 'Red') : L('Ámbar', 'Amber');
          changes.push(
            `${level} ${L('fuera de', 'outside')}: ${range(r.outside)} → ${range(next)} ${indicator.unit}`,
          );
        });
        if (changes.length === 0)
          return fail('Those are already the current thresholds: nothing would change.');

        const base = getBaseConfig().version;
        const names = new Set(versions.map((v) => v.version));
        let n = versions.length + 1;
        while (names.has(`${base}-earth.${n}`)) n++;
        const version = `${base}-earth.${n}`;
        const next = applyEdit(current, edit, version);
        if (!engineCheck(next, indicator.id, new Date()).ok)
          return fail(
            'With those ranges the rules engine no longer reads the middle of the green range as green. Choose other values.',
          );

        return {
          ok: true,
          lines: [
            name,
            ...changes,
            L(
              `Se envía como versión ${version} a la misión ${mission}; la tripulación la recibe en su próxima sincronización.`,
              `Sent as version ${version} to mission ${mission}; the crew gets it on their next sync.`,
            ),
            ...(input.note ? [`${L('Nota', 'Note')}: ${input.note}`] : []),
          ],
          run: async () => {
            const result = await saveRules(mission, {
              config: next as unknown as Record<string, unknown>,
              version,
              note: input.note ?? '',
              author,
            });
            return result.ok
              ? done(`Rules version ${version} sent to ${mission}. ${name}: ${changes.join('; ')}.`)
              : failed(result);
          },
        };
      },
    }),

    createMission: writeTool({
      description:
        'Creates a mission in preparation (no start date yet). Give a template id or your own phases; without either it starts with launch and reentry. Afterwards call switchMission with the returned code to work on it.',
      inputSchema: z.object({
        name: z.string().min(1).max(80),
        template: z.string().optional().describe('Template id from getCatalog("templates").'),
        phases: z.array(phaseSchema).min(1).max(40).optional(),
      }),
      plan: async (input) => {
        const name = input.name.trim();
        if (!name) return fail('The mission needs a name.');
        if (input.template && !missionTemplates.some((m) => m.id === input.template))
          return fail(
            `Unknown template "${input.template}". Templates: ${missionTemplates.map((m) => m.id).join(', ')}.`,
          );
        const phases: MissionPhase[] = input.phases ?? templatePhases(input.template ?? '');
        const stranger = unknownEnvironment(phases);
        if (stranger)
          return fail(
            `Unknown environment "${stranger}". Environments: ${[...environments.keys()].join(', ')}.`,
          );
        return {
          ok: true,
          lines: [
            `${L('Misión nueva', 'New mission')}: ${name}`,
            `${phasesText(phases)} · ${missionDays(phases)} ${L('días', 'days')}`,
            L(
              'Queda en preparación: se le añade la tripulación y se inicia después.',
              'It stays in preparation: add the crew and start it afterwards.',
            ),
          ],
          run: async () => {
            const result = await createMission({ name, phases, awaitingStart: true });
            return result.ok
              ? done(
                  `Mission "${result.data.name}" created with code ${result.data.code}. It is not the active mission yet: call switchMission to work on it.`,
                )
              : failed(result);
          },
        };
      },
    }),

    updateMission: writeTool({
      description:
        'Renames the active mission or, while it is still in preparation, changes its phase plan and when it starts. startMode "now" starts it today, "date" on startDate, "manual" leaves it waiting for someone to start it.',
      inputSchema: z.object({
        name: z.string().min(1).max(80).optional(),
        phases: z.array(phaseSchema).min(1).max(40).optional(),
        startMode: z.enum(['now', 'date', 'manual']).optional(),
        startDate: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional()
          .describe('YYYY-MM-DD (UTC), with startMode "date".'),
      }),
      plan: async (input) => {
        const found = await findMission(ctx.mission);
        if (!found.ok) return found;
        const stored = found.mission;
        const name = input.name?.trim();
        const planChange = Boolean(input.phases || input.startMode);
        if (!name && !planChange) return fail('Nothing to change: give a name, phases or a start.');
        if (stored.status === 'finished')
          return fail('A finished mission is a record: it cannot change.');
        if (planChange && stored.status === 'active')
          return fail(
            'The plan and the start can only change while the mission is in preparation.',
          );
        if (input.phases) {
          const stranger = unknownEnvironment(input.phases);
          if (stranger)
            return fail(
              `Unknown environment "${stranger}". Environments: ${[...environments.keys()].join(', ')}.`,
            );
        }
        let start: Date | undefined;
        if (input.startMode === 'date') {
          if (!input.startDate) return fail('startMode "date" needs startDate (YYYY-MM-DD).');
          start = new Date(`${input.startDate}T00:00:00Z`);
          if (Number.isNaN(start.getTime())) return fail(`"${input.startDate}" is not a date.`);
        } else if (input.startMode) start = new Date();

        const lines = [`${L('Misión', 'Mission')} ${stored.code} · ${stored.name}`];
        if (name && name !== stored.name)
          lines.push(`${L('Nombre', 'Name')}: ${stored.name} → ${name}`);
        if (input.phases)
          lines.push(
            `${L('Plan', 'Plan')}: ${phasesText(input.phases)} · ${missionDays(input.phases)} ${L('días', 'days')}`,
          );
        if (input.startMode === 'now')
          lines.push(L('Empieza hoy: pasa a estar en curso.', 'Starts today: it becomes active.'));
        if (input.startMode === 'date')
          lines.push(`${L('Empieza el', 'Starts on')} ${input.startDate}`);
        if (input.startMode === 'manual')
          lines.push(L('Queda a la espera de inicio manual.', 'Waits for a manual start.'));
        if (lines.length === 1)
          return fail('That is already how the mission is: nothing would change.');

        return {
          ok: true,
          lines,
          run: async () => {
            const result = await updateMission(stored.code, {
              ...(name ? { name } : {}),
              ...(input.phases ? { phases: input.phases } : {}),
              ...(start ? { start: start.toISOString() } : {}),
              ...(input.startMode ? { awaitingStart: input.startMode === 'manual' } : {}),
            });
            return result.ok
              ? done(`Mission ${stored.code} updated: ${lines.slice(1).join(' ')}`)
              : failed(result);
          },
        };
      },
    }),

    startMission: writeTool({
      description:
        'Starts the active mission, if it is in preparation: today becomes day 1. Every crew member must have joined from the app first.',
      inputSchema: z.object({}),
      plan: async () => {
        const found = await findMission(ctx.mission);
        if (!found.ok) return found;
        const stored = found.mission;
        if (stored.status === 'active' || stored.status === 'finished')
          return fail(`Mission ${stored.code} already started (status: ${stored.status}).`);
        if (stored.crew.length === 0)
          return fail('The mission has no crew yet: add crew members first.');
        return {
          ok: true,
          lines: [
            `${L('Iniciar la misión', 'Start mission')} ${stored.code} · ${stored.name}`,
            L(
              `Hoy pasa a ser el día 1 para ${stored.crew.length} tripulantes.`,
              `Today becomes day 1 for ${stored.crew.length} crew members.`,
            ),
          ],
          run: async () => {
            const result = await startMission(stored.code);
            if (result.ok) return done(`Mission ${stored.code} started: today is day 1.`);
            return result.details?.length
              ? fail(
                  `Crew not ready: ${result.details.join(', ')} have not joined from the app yet.`,
                )
              : failed(result);
          },
        };
      },
    }),

    finishMission: writeTool({
      description:
        'Finishes the active mission, if it is running. It becomes a read-only record: this cannot be undone from the app.',
      inputSchema: z.object({}),
      plan: async () => {
        const found = await findMission(ctx.mission);
        if (!found.ok) return found;
        const stored = found.mission;
        if (stored.status !== 'active')
          return fail(
            `Only a running mission can be finished; ${stored.code} is ${stored.status}.`,
          );
        return {
          ok: true,
          lines: [
            `${L('Finalizar la misión', 'Finish mission')} ${stored.code} · ${stored.name} (${L('día', 'day')} ${stored.day})`,
            L(
              'Queda como registro de solo lectura. No se puede deshacer.',
              'It becomes a read-only record. This cannot be undone.',
            ),
          ],
          run: async () => {
            const result = await finishMission(stored.code);
            return result.ok
              ? done(`Mission ${stored.code} finished on day ${stored.day}.`)
              : failed(result);
          },
        };
      },
    }),

    addCrewMember: writeTool({
      description:
        'Adds a crew member to the active mission. They join later from the phone with the invitation (see getInvitation).',
      inputSchema: z.object({
        name: z.string().min(1).max(60),
        role: z.string().max(60).optional().describe('E.g. Commander, Flight engineer.'),
      }),
      plan: async (input) => {
        const found = await findMission(ctx.mission);
        if (!found.ok) return found;
        const stored = found.mission;
        const name = input.name.trim();
        const role = input.role?.trim();
        if (!name) return fail('The crew member needs a name.');
        if (stored.status === 'finished')
          return fail('A finished mission is a record: it cannot change.');
        return {
          ok: true,
          lines: [
            `${L('Añadir a', 'Add')} ${name}${role ? ` (${role})` : ''}`,
            `${L('Misión', 'Mission')} ${stored.code} · ${stored.name}`,
          ],
          run: async () => {
            const result = await addCrewMember(stored.code, { name, ...(role ? { role } : {}) });
            return result.ok
              ? done(`${name} added to ${stored.code} with id ${result.data.id}.`)
              : failed(result);
          },
        };
      },
    }),

    updateCrewMember: writeTool({
      description: 'Changes the name or the role of a crew member. An empty role removes it.',
      inputSchema: z.object({
        crewMember: crewRef,
        name: z.string().min(1).max(60).optional(),
        role: z.string().max(60).optional(),
      }),
      plan: async (input) => {
        const found = await findMission(ctx.mission);
        if (!found.ok) return found;
        const stored = found.mission;
        const who = findCrew(stored, input.crewMember);
        if (!who.ok) return who;
        if (stored.status === 'finished')
          return fail('A finished mission is a record: it cannot change.');
        const before = { name: who.member.name, role: translate(who.member.role, lang) };
        const name = input.name?.trim() || before.name;
        const role = input.role === undefined ? before.role : input.role.trim();
        if (name === before.name && role === before.role)
          return fail('That is already their name and role: nothing would change.');
        const none = L('sin rol', 'no role');
        return {
          ok: true,
          lines: [
            `${before.name} · ${L('misión', 'mission')} ${stored.code}`,
            ...(name !== before.name ? [`${L('Nombre', 'Name')}: ${before.name} → ${name}`] : []),
            ...(role !== before.role
              ? [`${L('Rol', 'Role')}: ${before.role || none} → ${role || none}`]
              : []),
          ],
          run: async () => {
            const result = await updateCrewMember(stored.code, who.member.id, {
              name,
              ...(role ? { role } : {}),
            });
            return result.ok
              ? done(`${before.name} is now ${name}${role ? ` (${role})` : ''}.`)
              : failed(result);
          },
        };
      },
    }),

    removeCrewMember: writeTool({
      description:
        'Removes a crew member from the active mission and deletes every packet they sent. This cannot be undone.',
      inputSchema: z.object({ crewMember: crewRef }),
      plan: async (input) => {
        const found = await findMission(ctx.mission);
        if (!found.ok) return found;
        const stored = found.mission;
        const who = findCrew(stored, input.crewMember);
        if (!who.ok) return who;
        if (stored.status === 'finished')
          return fail('A finished mission is a record: it cannot change.');
        return {
          ok: true,
          lines: [
            `${L('Quitar a', 'Remove')} ${who.member.name} ${L('de la misión', 'from mission')} ${stored.code} · ${stored.name}`,
            L(
              'Se borran también todos los paquetes que envió. No se puede deshacer.',
              'Every packet they sent is deleted too. This cannot be undone.',
            ),
          ],
          run: async () => {
            const result = await removeCrewMember(stored.code, who.member.id);
            return result.ok
              ? done(
                  `${who.member.name} removed from ${stored.code}; ${result.data.packets} packets deleted.`,
                )
              : failed(result);
          },
        };
      },
    }),

    setMedicationPlan: writeTool({
      description:
        'Replaces the medication plan of one crew member with the list given (send the whole list, not only what changes; an empty list clears the plan). A medication keeps the schedule it had unless a new one is given.',
      inputSchema: z.object({
        crewMember: crewRef,
        medications: z
          .array(
            z.object({
              medication: z.string().describe('Medication id from getCatalog("medications").'),
              until: z
                .string()
                .regex(/^\d{4}-\d{2}-\d{2}$/)
                .optional()
                .describe('Last day of the treatment, YYYY-MM-DD; open-ended when omitted.'),
              note: z.string().max(200).optional(),
              schedule: scheduleSchema
                .optional()
                .describe(
                  'Only to replace the catalog schedule. Times are HH:MM, mission time (UTC).',
                ),
            }),
          )
          .max(20),
      }),
      plan: async (input) => {
        const found = await findMission(ctx.mission);
        if (!found.ok) return found;
        const stored = found.mission;
        const who = findCrew(stored, input.crewMember);
        if (!who.ok) return who;
        const catalog = new Map(medications.catalog.map((m) => [m.id, m]));
        const stranger = input.medications.find((m) => !catalog.has(m.medication));
        if (stranger)
          return fail(
            `Unknown medication "${stranger.medication}". Catalog: ${[...catalog.keys()].join(', ')}.`,
          );
        const current = await getCrewPlan(stored.code, who.member.id);
        const assignments = input.medications.map((m) => {
          const schedule =
            m.schedule ?? current.medications.find((a) => a.medication === m.medication)?.schedule;
          return {
            medication: m.medication,
            ...(schedule ? { schedule } : {}),
            ...(m.until ? { until: m.until } : {}),
            ...(m.note?.trim() ? { note: m.note.trim() } : {}),
          };
        });
        const cleaned = cleanAssignments(assignments, medications);
        if (cleaned.length !== assignments.length)
          return fail('The list repeats a medication: each one can appear once.');
        const dropped = cleaned.find(
          (c, i) => Boolean(assignments[i]?.schedule) !== Boolean(c.schedule),
        );
        if (dropped)
          return fail(
            `The schedule of ${dropped.medication} is not valid: times are HH:MM (24 h) and weekday is 0–6.`,
          );
        const label = (a: { medication: string; until?: string }) =>
          `${translate(catalog.get(a.medication)?.name, lang) || a.medication}${
            a.until ? ` (${L('hasta', 'until')} ${a.until})` : ''
          }`;
        const none = L('ninguna', 'none');
        return {
          ok: true,
          lines: [
            `${L('Plan de medicación de', 'Medication plan of')} ${who.member.name}`,
            `${L('Antes', 'Before')}: ${current.medications.map(label).join(', ') || none}`,
            `${L('Después', 'After')}: ${cleaned.map(label).join(', ') || none}`,
            L(
              'La app lo descarga en su próxima sincronización.',
              'The app downloads it on its next sync.',
            ),
          ],
          run: async () => {
            const result = await saveMedicationPlan(
              stored.code,
              who.member.id,
              assignments,
              author,
            );
            return result.ok
              ? done(
                  `Medication plan of ${who.member.name} saved: ${cleaned.map(label).join(', ') || 'no medications'}.`,
                )
              : failed(result);
          },
        };
      },
    }),

    saveSampleResult: writeTool({
      description:
        'Stores the lab result of a sample the crew already collected. Give the values by analyte id and the result is classified from them; override only to set a different result on purpose. Sample ids and analytes come from getCountermeasures("samples").',
      inputSchema: z.object({
        sampleId: z
          .string()
          .min(1)
          .max(200)
          .describe('Id of the collection (pending or already loaded).'),
        values: z
          .array(z.object({ analyte: z.string().describe('Analyte id.'), value: z.number() }))
          .max(40)
          .optional()
          .describe('Lab values, one per analyte.'),
        override: z.enum(['normal', 'abnormal', 'critical']).optional(),
        detail: z.string().max(280).optional().describe('Comment for the record.'),
      }),
      plan: async (input) => {
        const found = await findMission(ctx.mission);
        if (!found.ok) return found;
        const stored = found.mission;
        const overview = await getSampleOverview(stored.code);
        const collection =
          overview?.pending.find((p) => p.id === input.sampleId) ??
          overview?.results.find((r) => r.id === input.sampleId);
        if (!collection)
          return fail(
            `No collected sample has the id "${input.sampleId}". Call getCountermeasures with area "samples" for the pending ones.`,
          );
        const sample = sampleConfig.samples.find((s) => s.id === collection.sample);
        if (!sample) return fail(`Unknown sample type ${collection.sample}.`);
        const analytes = new Map(sample.analytes.map((a) => [a.id, a]));
        const values = Object.fromEntries((input.values ?? []).map((v) => [v.analyte, v.value]));
        const stranger = Object.keys(values).find((id) => !analytes.has(id));
        if (stranger)
          return fail(
            `"${stranger}" is not an analyte of ${sample.id}. Analytes: ${[...analytes.keys()].join(', ') || 'none'}.`,
          );
        const { level: computed, flags } = classifySample(sample, values);
        const result = input.override ?? computed;
        if (!result) return fail('Give at least one value or choose a result with override.');
        const who =
          stored.crew.find((m) => m.id === collection.crewMember)?.name ?? collection.crewMember;
        return {
          ok: true,
          lines: [
            `${translate(sample.name, lang)} · ${who} · ${L('recogida el', 'collected on')} ${collection.collectedAt.slice(0, 10)}`,
            ...flags.map((f) => `${f.analyte}: ${f.value} (${f.level})`),
            `${L('Resultado', 'Result')}: ${result}${
              input.override && input.override !== computed
                ? ` (${L('fijado a mano; calculado', 'set by hand; computed')}: ${computed ?? '—'})`
                : ''
            }`,
            ...(input.detail ? [`${L('Detalle', 'Detail')}: ${input.detail}`] : []),
          ],
          run: async () => {
            const saved = await saveSampleResult(stored.code, {
              id: input.sampleId,
              values,
              ...(input.override ? { override: input.override } : {}),
              detail: input.detail ?? '',
              author,
            });
            return saved.ok
              ? done(`Result of ${sample.id} for ${who} saved: ${saved.data.result}.`)
              : failed(saved);
          },
        };
      },
    }),

    setExercisePrescription: writeTool({
      description: `Sets the exercise prescription of one crew member (daily minutes of resistance and aerobic exercise and training days a week), or with reset returns them to the starting prescription. Minutes ${exercise.limits.minutes.join('–')} each (not both 0), days ${exercise.limits.daysPerWeek.join('–')}. Send the three numbers together.`,
      inputSchema: z.object({
        crewMember: crewRef,
        reset: z.boolean().optional().describe("true to drop Earth's change."),
        resistanceMinutes: z.number().int().optional(),
        aerobicMinutes: z.number().int().optional(),
        daysPerWeek: z.number().int().optional(),
        note: z.string().max(200).optional(),
      }),
      plan: async (input) => {
        const found = await findMission(ctx.mission);
        if (!found.ok) return found;
        const stored = found.mission;
        const who = findCrew(stored, input.crewMember);
        if (!who.ok) return who;
        const plan = await getCrewPlan(stored.code, who.member.id);
        const before = prescriptionOf(plan, exercise);
        const text = (p: {
          resistanceMinutes: number;
          aerobicMinutes: number;
          daysPerWeek: number;
        }) =>
          L(
            `${p.resistanceMinutes} min de fuerza + ${p.aerobicMinutes} min aeróbico, ${p.daysPerWeek} días por semana`,
            `${p.resistanceMinutes} min resistance + ${p.aerobicMinutes} min aerobic, ${p.daysPerWeek} days a week`,
          );
        const heading = `${L('Pauta de ejercicio de', 'Exercise prescription of')} ${who.member.name}`;
        if (input.reset) {
          if (!plan.exercise)
            return fail(`${who.member.name} already follows the starting prescription.`);
          return {
            ok: true,
            lines: [
              heading,
              `${L('Antes', 'Before')}: ${text(before)}`,
              `${L('Después (pauta inicial)', 'After (starting prescription)')}: ${text(exercise.prescription)}`,
            ],
            run: async () => {
              const result = await saveExercisePrescription(
                stored.code,
                who.member.id,
                null,
                author,
              );
              return result.ok
                ? done(`${who.member.name} is back on the starting prescription.`)
                : failed(result);
            },
          };
        }
        const next = cleanPrescription(
          {
            resistanceMinutes: input.resistanceMinutes ?? before.resistanceMinutes,
            aerobicMinutes: input.aerobicMinutes ?? before.aerobicMinutes,
            daysPerWeek: input.daysPerWeek ?? before.daysPerWeek,
            note: input.note,
          },
          exercise,
        );
        if (!next)
          return fail(
            `Out of limits: minutes are whole numbers ${exercise.limits.minutes.join('–')} (not both 0) and days per week ${exercise.limits.daysPerWeek.join('–')}.`,
          );
        if (
          plan.exercise &&
          next.resistanceMinutes === before.resistanceMinutes &&
          next.aerobicMinutes === before.aerobicMinutes &&
          next.daysPerWeek === before.daysPerWeek &&
          (next.note ?? '') === (before.note ?? '')
        )
          return fail('That is already their prescription: nothing would change.');
        return {
          ok: true,
          lines: [
            heading,
            `${L('Antes', 'Before')}: ${text(before)}`,
            `${L('Después', 'After')}: ${text(next)}`,
            ...(next.note ? [`${L('Nota', 'Note')}: ${next.note}`] : []),
            L(
              'La app la descarga en su próxima sincronización.',
              'The app downloads it on its next sync.',
            ),
          ],
          run: async () => {
            const result = await saveExercisePrescription(stored.code, who.member.id, next, author);
            return result.ok
              ? done(`Prescription of ${who.member.name}: ${text(next)}.`)
              : failed(result);
          },
        };
      },
    }),

    editKpiDashboard: writeTool({
      description:
        "Edits the mission's saved KPI dashboard (the /kpi page): add, change or remove panels, or change its period. Read it with getKpiDashboard first to get the panel ids. To only show a chart in this chat use showPanel instead.",
      inputSchema: z.object({
        operations: z
          .array(
            z.union([
              z.object({
                op: z.literal('add'),
                type: z.enum(KPI_PANEL_TYPES),
                series: z.array(seriesSchema).min(1).max(5),
                title: z.string().max(80).optional(),
                range: z
                  .enum(KPI_RANGES)
                  .optional()
                  .describe("Own period; the dashboard's when omitted."),
              }),
              z.object({
                op: z.literal('update'),
                panelId: z.string(),
                type: z.enum(KPI_PANEL_TYPES).optional(),
                series: z.array(seriesSchema).min(1).max(5).optional(),
                title: z.string().max(80).optional(),
                range: z.enum(KPI_RANGES).optional(),
              }),
              z.object({ op: z.literal('remove'), panelId: z.string() }),
              z.object({ op: z.literal('setRange'), range: z.enum(KPI_RANGES) }),
            ]),
          )
          .min(1)
          .max(12),
      }),
      plan: async (input) => {
        const found = await findMission(ctx.mission);
        if (!found.ok) return found;
        const stored = found.mission;
        const data = await loadKpiData({
          mission: stored.code,
          crew: stored.crew.map(({ id, name }) => ({ id, name })),
          lang,
          t: extrasTexts[lang],
        });
        let dashboard: KpiDashboard = data.saved ?? defaultDashboard(data.withData);
        const lines: string[] = [
          `${L('Tablero KPI de', 'KPI dashboard of')} ${stored.code} · ${stored.name}`,
        ];
        const describe = (panel: KpiPanel) =>
          `${panel.title ? `«${panel.title}» · ` : ''}${panel.type} · ${panel.series
            .map((s) => {
              const indicator =
                data.indicators.find((i) => i.id === s.indicator)?.name ?? s.indicator;
              const source = data.sources.find((x) => x.id === s.source)?.name ?? s.source;
              return `${indicator} (${source})`;
            })
            .join(', ')}`;

        for (const op of input.operations) {
          if (op.op === 'setRange') {
            lines.push(`${L('Periodo', 'Period')}: ${dashboard.range} → ${op.range}`);
            dashboard = { ...dashboard, range: op.range };
            continue;
          }
          if (op.op === 'remove') {
            const panel = dashboard.panels.find((p) => p.id === op.panelId);
            if (!panel) return fail(`No panel has the id "${op.panelId}". Call getKpiDashboard.`);
            lines.push(`${L('Quitar', 'Remove')}: ${describe(panel)}`);
            dashboard = removePanel(dashboard, panel.id);
            continue;
          }
          if (op.op === 'add') {
            const checked = checkSeries(data, op.type, op.series);
            if (!checked.ok) return checked;
            const panel: KpiPanel = {
              id: panelId(crypto.randomUUID()),
              type: op.type,
              ...(op.title?.trim() ? { title: op.title.trim() } : {}),
              series: checked.series,
              ...(op.range ? { range: op.range } : {}),
              reference: true,
              ...(op.type === 'timeseries' ? { markers: false } : {}),
            };
            lines.push(`${L('Añadir', 'Add')}: ${describe(panel)}`);
            dashboard = addPanel(dashboard, panel);
            continue;
          }
          const current = dashboard.panels.find((p) => p.id === op.panelId);
          if (!current) return fail(`No panel has the id "${op.panelId}". Call getKpiDashboard.`);
          const type = op.type ?? current.type;
          const checked = checkSeries(data, type, op.series ?? current.series);
          if (!checked.ok) return checked;
          const { markers, title, range: ownRange, ...rest } = current;
          const nextTitle = op.title === undefined ? title : op.title.trim();
          const nextRange = op.range ?? ownRange;
          const panel: KpiPanel = {
            ...rest,
            type,
            series: checked.series,
            ...(nextTitle ? { title: nextTitle } : {}),
            ...(nextRange ? { range: nextRange } : {}),
            ...(type === 'timeseries' && markers !== undefined ? { markers } : {}),
          };
          lines.push(`${L('Cambiar', 'Change')}: ${describe(current)} → ${describe(panel)}`);
          dashboard = updatePanel(dashboard, panel);
        }

        const checked = validateDashboard(dashboard);
        if (!checked.ok)
          return fail(`The dashboard would not be valid: ${checked.errors.join('; ')}.`);
        return {
          ok: true,
          lines,
          run: async () => {
            const result = await saveKpiDashboardFor(stored.code, checked.dashboard);
            return result.ok
              ? done(
                  `KPI dashboard saved with ${checked.dashboard.panels.length} panels. The operator sees it at /kpi.`,
                )
              : failed(result);
          },
        };
      },
    }),
  };
}

export type WriteTools = ReturnType<typeof createWriteTools>;
