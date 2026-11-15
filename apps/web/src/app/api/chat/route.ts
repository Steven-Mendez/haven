import type { OpenAILanguageModelResponsesOptions } from '@ai-sdk/openai';
import {
  APICallError,
  convertToModelMessages,
  createUIMessageStreamResponse,
  isStepCount,
  streamText,
  toUIMessageStream,
} from 'ai';
import { approvalSecret, assistantConfigured, assistantModel } from '@/assistant/server/model';
import { instructions } from '@/assistant/server/prompt';
import { createAssistantTools } from '@/assistant/server/tools';
import {
  type AssistantContext,
  type AssistantMessage,
  checkPreferences,
  type Preferences,
} from '@/assistant/types';
import { havenTexts } from '@/components/haven/texts';
import { getMission } from '@/features/extras/server';
import { getLanguage } from '@/lib/language';
import { getMissionCode } from '@/lib/mission';

// A turn can chain several lookups and a report: give it room on Vercel.
export const maxDuration = 300;

const MAX_MESSAGES = 200;
const MAX_STEPS = 16;

const problem = (status: number, error: string) => Response.json({ error }, { status });

/** The mission on screen when the message was sent: a code, none, or not said. */
function shownMission(body: object): string | null | undefined {
  if (!('mission' in body)) return undefined;
  const { mission } = body;
  if (mission === null) return null;
  return typeof mission === 'string' && /^[A-Z0-9]{6}$/.test(mission) ? mission : undefined;
}

/**
 * Orion AI: the chat of the Ground View. Same-origin only (no CORS headers,
 * unlike the API the phones call): it is for the operator's browser.
 */
export async function POST(request: Request) {
  if (!assistantConfigured()) return problem(503, 'not-configured');

  let messages: AssistantMessage[];
  let preferences: Preferences;
  let shown: string | null | undefined;
  try {
    const body = (await request.json()) as { messages?: unknown };
    if (!Array.isArray(body.messages) || body.messages.length === 0) throw new Error('messages');
    messages = body.messages as AssistantMessage[];
    preferences = checkPreferences(body);
    shown = shownMission(body);
  } catch {
    return problem(400, 'Body must be JSON with a non-empty messages array');
  }
  if (messages.length > MAX_MESSAGES) return problem(413, 'too-long');

  // The mission the chat shows wins over the cookie: another tab may have changed the
  // cookie since, and Orion must not answer about a mission the operator is not looking at.
  const [lang, code] = await Promise.all([
    getLanguage(),
    shown === undefined ? getMissionCode() : shown,
  ]);
  const mission = code ? await getMission(code).catch(() => null) : null;
  const ctx: AssistantContext = {
    mission: mission?.code ?? null,
    lang,
    author: `${havenTexts[lang].operatorName} · Orion AI`,
  };
  const { tools, toolApproval } = createAssistantTools(ctx);

  let history: Awaited<ReturnType<typeof convertToModelMessages>>;
  try {
    history = await convertToModelMessages(messages, { tools, ignoreIncompleteToolCalls: true });
  } catch {
    return problem(400, 'Invalid messages');
  }

  const result = streamText({
    model: assistantModel(preferences.model),
    providerOptions: {
      openai: {
        reasoningEffort: preferences.effort,
        // Orion does not show the model's reasoning, so it asks for no summary of it.
        reasoningSummary: null,
        // Crew health data is not kept at the provider, and a saved conversation
        // never depends on something stored there.
        store: false,
      } satisfies OpenAILanguageModelResponsesOptions,
    },
    instructions: instructions(ctx, mission, new Date()),
    messages: history,
    tools,
    toolApproval,
    experimental_toolApprovalSecret: approvalSecret(),
    stopWhen: isStepCount(MAX_STEPS),
    abortSignal: request.signal,
    onError: ({ error }) => console.error('[orion]', error),
  });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({
      stream: result.stream,
      tools,
      originalMessages: messages,
      sendReasoning: false,
      // The browser gets a code, not the provider's message or the key's state.
      onError: (error) =>
        APICallError.isInstance(error) && (error.statusCode === 401 || error.statusCode === 403)
          ? 'auth'
          : APICallError.isInstance(error) && error.statusCode === 429
            ? 'busy'
            : 'failed',
    }),
  });
}
