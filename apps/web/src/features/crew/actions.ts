'use server';

import { refresh } from 'next/cache';
import { CREW_NOT_READY } from '@/server/types';
import { addCrewMember, removeCrewMember, startMission, updateCrewMember } from './server';

export type RosterFormState =
  | { status: 'idle' }
  | { status: 'error'; code: 'name' | 'save' }
  | { status: 'ok'; at: number; id?: string };

const text = (v: FormDataEntryValue | null, max: number) =>
  typeof v === 'string' ? v.trim().slice(0, max) : '';

function readInput(form: FormData) {
  const name = text(form.get('name'), 60);
  const role = text(form.get('role'), 60);
  return { name, ...(role ? { role } : {}) };
}

export async function addCrewAction(
  mission: string,
  _previous: RosterFormState,
  form: FormData,
): Promise<RosterFormState> {
  const input = readInput(form);
  if (!input.name) return { status: 'error', code: 'name' };
  const result = await addCrewMember(mission, input);
  if (!result.ok) return { status: 'error', code: 'save' };
  refresh();
  return { status: 'ok', at: Date.now(), id: result.data.id };
}

export async function updateCrewAction(
  mission: string,
  id: string,
  _previous: RosterFormState,
  form: FormData,
): Promise<RosterFormState> {
  const input = readInput(form);
  if (!input.name) return { status: 'error', code: 'name' };
  const result = await updateCrewMember(mission, id, input);
  if (!result.ok) return { status: 'error', code: 'save' };
  refresh();
  return { status: 'ok', at: Date.now() };
}

export async function removeCrewAction(mission: string, id: string): Promise<RosterFormState> {
  const result = await removeCrewMember(mission, id);
  if (!result.ok) return { status: 'error', code: 'save' };
  refresh();
  return { status: 'ok', at: Date.now() };
}

export async function startMissionAction(
  mission: string,
): Promise<{ failed: boolean; notReady?: boolean }> {
  const result = await startMission(mission);
  if (!result.ok) return { failed: true, notReady: result.error === CREW_NOT_READY };
  refresh();
  return { failed: false };
}
