'use client';

import { Chat } from '@ai-sdk/react';
import { type ChatOnToolCallCallback, DefaultChatTransport, getToolName, isToolUIPart } from 'ai';
import type { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { setLanguage } from '@/components/haven/actions';
import { THEME_COOKIE } from '@/components/haven/theme';
import type { Language } from '@/lib/i18n';
import { activateMission } from './actions';
import { texts } from './i18n';
import {
  type AssistantMessage,
  CLIENT_TOOLS,
  type ClientTool,
  checkPreferences,
  DEFAULT_PREFERENCES,
  type Preferences,
  WRITE_TOOLS,
} from './types';

export const ORION_PATH = '/orion';

/**
 * What the chats need from the page they live in. The root layout registers it
 * on every page, so a turn that is still running keeps working after the operator
 * (or Orion itself) navigates away from the chat.
 */
export const bridge: {
  router?: ReturnType<typeof useRouter>;
  lang: Language;
  pathname: string;
  /** The mission the chat shows: every request is bound to it. */
  mission: string | null;
} = { lang: 'es', pathname: '', mission: null };

// --- Model and depth, chosen in the composer --------------------------------

const PREFERENCES_KEY = 'haven-orion-preferences';
let preferences: Preferences = DEFAULT_PREFERENCES;

export function readPreferences(): Preferences {
  try {
    preferences = checkPreferences(
      JSON.parse(window.localStorage.getItem(PREFERENCES_KEY) ?? '{}'),
    );
  } catch {
    preferences = DEFAULT_PREFERENCES;
  }
  return preferences;
}

export function savePreferences(next: Preferences) {
  preferences = next;
  try {
    window.localStorage.setItem(PREFERENCES_KEY, JSON.stringify(next));
  } catch {
    // Without storage the choice lasts for this visit.
  }
}

const isClientTool = (name: string): name is ClientTool =>
  (CLIENT_TOOLS as readonly string[]).includes(name);
const isWriteTool = (name: string) => (WRITE_TOOLS as readonly string[]).includes(name);

/**
 * Sends the conversation back by itself when the last step was waiting on the
 * browser and is now settled: the operator answered every confirmation card,
 * or a tool that runs here (switch mission, open page…) produced its result.
 */
export function shouldContinue({ messages }: { messages: AssistantMessage[] }): boolean {
  const last = messages.at(-1);
  if (last?.role !== 'assistant') return false;
  const start = last.parts.findLastIndex((p) => p.type === 'step-start');
  const calls = last.parts.slice(start + 1).filter(isToolUIPart);
  if (calls.length === 0) return false;
  const settled = calls.every(
    (p) =>
      p.state === 'approval-responded' ||
      p.state === 'output-denied' ||
      p.state === 'output-error' ||
      (p.state === 'output-available' && p.preliminary !== true),
  );
  if (!settled) return false;
  return calls.some(
    (p) =>
      p.state === 'approval-responded' ||
      (isClientTool(getToolName(p)) &&
        (p.state === 'output-available' || p.state === 'output-error')),
  );
}

/**
 * The operator answered Orion's request to change mission. Only their click
 * changes it; the chat then carries the new mission in every request.
 */
export async function answerMissionSwitch(
  chat: Chat<AssistantMessage>,
  toolCallId: string,
  code: string,
  approved: boolean,
) {
  if (!approved) {
    chat.addToolOutput({
      tool: 'switchMission',
      toolCallId,
      output: {
        ok: false,
        message: 'The operator declined to change mission. Stay on the current one.',
      },
    });
    return;
  }
  try {
    const result = await activateMission(code);
    if (result.ok) bridge.mission = result.code;
    chat.addToolOutput({
      tool: 'switchMission',
      toolCallId,
      output: result.ok
        ? { ok: true, message: `The active mission is now ${result.name} (${result.code}).` }
        : { ok: false, message: 'That mission does not exist.' },
    });
    if (result.ok) bridge.router?.refresh();
  } catch {
    chat.addToolOutput({
      tool: 'switchMission',
      toolCallId,
      state: 'output-error',
      errorText: 'The browser could not change the mission.',
    });
  }
}

function changedSomething(message: AssistantMessage): boolean {
  return message.parts.some(
    (p) => isToolUIPart(p) && isWriteTool(getToolName(p)) && p.state === 'output-available',
  );
}

function create(id: string, messages: AssistantMessage[]): Chat<AssistantMessage> {
  const onToolCall: ChatOnToolCallCallback<AssistantMessage> = async ({ toolCall }) => {
    if (toolCall.dynamic) return;
    const toolCallId = toolCall.toolCallId;
    try {
      switch (toolCall.toolName) {
        case 'openPage': {
          const { path } = toolCall.input;
          const valid = path.startsWith('/') && !path.startsWith('//') && !path.includes('\\');
          chat.addToolOutput({
            tool: 'openPage',
            toolCallId,
            output: valid
              ? { ok: true, message: `Opened ${path}. The operator now sees that page.` }
              : { ok: false, message: 'Only pages of the Ground View can be opened.' },
          });
          if (!valid) return;
          const leaving = bridge.pathname === ORION_PATH && !path.startsWith(ORION_PATH);
          if (bridge.router) bridge.router.push(path);
          else window.location.assign(path);
          if (leaving) {
            const t = texts[bridge.lang];
            toast(t.openedPage, {
              duration: 10_000,
              action: { label: t.backToChat, onClick: () => bridge.router?.push(ORION_PATH) },
            });
          }
          return;
        }
        case 'setLanguage': {
          const form = new FormData();
          form.set('lang', toolCall.input.language);
          await setLanguage(form);
          chat.addToolOutput({ tool: 'setLanguage', toolCallId, output: { ok: true } });
          bridge.router?.refresh();
          return;
        }
        case 'setTheme': {
          const { theme } = toolCall.input;
          document.documentElement.classList.toggle('dark', theme === 'dark');
          // biome-ignore lint/suspicious/noDocumentCookie: a plain preference cookie, read by THEME_SCRIPT
          document.cookie = `${THEME_COOKIE}=${theme}; path=/; max-age=31536000; samesite=lax`;
          chat.addToolOutput({ tool: 'setTheme', toolCallId, output: { ok: true } });
          return;
        }
      }
    } catch {
      if (isClientTool(toolCall.toolName))
        chat.addToolOutput({
          tool: toolCall.toolName,
          toolCallId,
          state: 'output-error',
          errorText: 'The browser could not do it.',
        });
    }
  };

  const chat: Chat<AssistantMessage> = new Chat<AssistantMessage>({
    id,
    messages,
    // Read on every request, so the turns Orion continues by itself use the current choice.
    transport: new DefaultChatTransport({
      api: '/api/chat',
      body: () => ({ ...preferences, mission: bridge.mission }),
    }),
    sendAutomaticallyWhen: shouldContinue,
    onToolCall,
    // A change went through: the sidebar, the header and any open page are stale.
    onFinish: ({ message }) => {
      if (changedSomething(message)) bridge.router?.refresh();
    },
  });
  return chat;
}

// --- Conversations ---------------------------------------------------------
// They live in this browser: there are no operator accounts on Earth yet.

export type SavedChat = {
  id: string;
  title: string;
  updatedAt: number;
  messages: AssistantMessage[];
};

const STORAGE_KEY = 'haven-orion-chats';
const MAX_SAVED = 20;

const live = new Map<string, Chat<AssistantMessage>>();
let currentId: string | undefined;

export const newChatId = () => crypto.randomUUID();

export function readHistory(): SavedChat[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const list = raw ? (JSON.parse(raw) as SavedChat[]) : [];
    return Array.isArray(list) ? list.filter((c) => c?.id && Array.isArray(c.messages)) : [];
  } catch {
    return [];
  }
}

function writeHistory(list: SavedChat[]): SavedChat[] {
  // Charts carry their data, so a long history may not fit: drop the oldest until it does.
  for (let keep = Math.min(list.length, MAX_SAVED); keep >= 0; keep--) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, keep)));
      return list.slice(0, keep);
    } catch {
      // Storage is full or unavailable: try with one conversation less.
    }
  }
  return [];
}

function titleOf(messages: AssistantMessage[]): string {
  const first = messages.find((m) => m.role === 'user');
  const text = first?.parts.find((p) => p.type === 'text');
  const line = (text?.type === 'text' ? text.text : '').replace(/\s+/g, ' ').trim();
  return line.length > 60 ? `${line.slice(0, 59)}…` : line || 'Orion AI';
}

export function saveChat(id: string, messages: AssistantMessage[]): SavedChat[] {
  const rest = readHistory().filter((c) => c.id !== id);
  if (messages.length === 0) return rest;
  return writeHistory([{ id, title: titleOf(messages), updatedAt: Date.now(), messages }, ...rest]);
}

export function deleteChat(id: string): SavedChat[] {
  live.get(id)?.stop();
  live.delete(id);
  return writeHistory(readHistory().filter((c) => c.id !== id));
}

/** The chat the operator was on, so coming back to Orion finds it as they left it. */
export function currentChatId(): string {
  currentId ??= newChatId();
  return currentId;
}

export function setCurrentChatId(id: string) {
  currentId = id;
}

/** One live chat per conversation for the whole visit; the server never keeps one. */
export function chatFor(id: string): Chat<AssistantMessage> {
  if (typeof window === 'undefined') return create(id, []);
  let chat = live.get(id);
  if (!chat) {
    chat = create(id, readHistory().find((c) => c.id === id)?.messages ?? []);
    live.set(id, chat);
  }
  return chat;
}
