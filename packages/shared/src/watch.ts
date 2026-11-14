// Contrato iPhone ↔ Apple Watch. Espejo en Swift: apps/mobile/targets/watch/Contract/Contract.swift.
// El iPhone es el único que habla con la API; el reloj recibe estado y envía acciones.

import type { Item } from './index';

export const WATCH_CONTRACT_VERSION = 1;

export type WatchMessages = {
  /** iPhone → reloj */
  items: { items: Item[] };
  /** reloj → iPhone */
  addItem: { title: string };
  /** reloj → iPhone: pide reenviar `items` */
  sync: Record<string, never>;
};

export type WatchMessageType = keyof WatchMessages;

export type WatchEnvelope<T extends WatchMessageType = WatchMessageType> = {
  v: typeof WATCH_CONTRACT_VERSION;
  type: T;
  sentAt: string;
  payload: WatchMessages[T];
};

/** Tipos de estado: también se guardan en applicationContext. */
export const WATCH_STATE_TYPES: readonly WatchMessageType[] = ['items'];

export function envelope<T extends WatchMessageType>(type: T, payload: WatchMessages[T]): WatchEnvelope<T> {
  return { v: WATCH_CONTRACT_VERSION, type, sentAt: new Date().toISOString(), payload };
}
