import 'server-only';
import { createHmac } from 'node:crypto';
import { openai } from '@ai-sdk/openai';
import type { ModelId } from '../types';

/** Orion only works with a key: without one the page explains how to set it up. */
export function assistantConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

export function assistantModel(id: ModelId) {
  return openai(id);
}

/**
 * Signs every confirmation card, so a change runs only if this server asked
 * for it and the operator approved exactly that input. Derived from the API
 * key when no secret is set, so every instance of a deployment agrees.
 */
export function approvalSecret(): string {
  const own = process.env.HAVEN_ASSISTANT_SECRET?.trim();
  if (own) return own;
  return createHmac('sha256', process.env.OPENAI_API_KEY ?? '')
    .update('haven-orion-tool-approval')
    .digest('hex');
}
