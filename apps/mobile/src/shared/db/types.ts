import type { Reading } from '@haven/core';
import type { SQLiteDatabase } from 'expo-sqlite';

export type KeyValueTable = 'kv' | 'preferences' | 'mission';

export interface KeyValue {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T): Promise<void>;
  remove(key: string): Promise<void>;
  all(): Promise<Record<string, unknown>>;
}

export interface Collection<T> {
  all(): Promise<T[]>;
  get(id: string): Promise<T | undefined>;
  put(id: string, value: T): Promise<void>;
  remove(id: string): Promise<void>;
  clear(): Promise<void>;
}

export interface Database {
  readonly driver: 'sqlite' | 'web';
  open(): Promise<void>;
  sqlite(): SQLiteDatabase | null;
  migrate(table: string, steps: string[]): Promise<void>;
  keyValue(table: KeyValueTable): KeyValue;
  collection<T>(name: string): Collection<T>;
  readings: {
    all(): Promise<Reading[]>;
    put(readings: Reading[]): Promise<void>;
    remove(ids: string[]): Promise<void>;
    clear(): Promise<void>;
  };
  reset(): Promise<void>;
}
