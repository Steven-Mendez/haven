import type { Reading } from '@haven/core';
import type { SQLiteDatabase } from 'expo-sqlite';

/** Key-value tables (JSON values) created by M00. */
export type KeyValueTable = 'kv' | 'preferences' | 'mission';

export interface KeyValue {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T): Promise<void>;
  remove(key: string): Promise<void>;
  all(): Promise<Record<string, unknown>>;
}

/**
 * Collection of JSON documents by id. Works the same on iOS, Android (SQLite) and the web build
 * (localStorage). The recommended way to add new tables (e.g. the M09 queue).
 */
export interface Collection<T> {
  all(): Promise<T[]>;
  get(id: string): Promise<T | undefined>;
  put(id: string, value: T): Promise<void>;
  remove(id: string): Promise<void>;
  clear(): Promise<void>;
}

export interface Database {
  /** `'sqlite'` on iOS and Android; `'web'` on web (localStorage, no SQL). */
  readonly driver: 'sqlite' | 'web';
  /** Opens the database and applies the M00 migrations. Idempotent. */
  open(): Promise<void>;
  /**
   * The open expo-sqlite database, or `null` on web. Call `open()` first. Its async writes
   * (`runAsync`, `execAsync`, transactions) go through the same single write queue as `db.*`.
   */
  sqlite(): SQLiteDatabase | null;
  /**
   * Simple per-table migrations: applies, in order, the SQL steps of `steps` not yet applied to
   * `table` (the version is kept in `_migrations`). No-op on web.
   */
  migrate(table: string, steps: string[]): Promise<void>;
  keyValue(table: KeyValueTable): KeyValue;
  collection<T>(name: string): Collection<T>;
  readings: {
    all(): Promise<Reading[]>;
    put(readings: Reading[]): Promise<void>;
    remove(ids: string[]): Promise<void>;
    clear(): Promise<void>;
  };
  /** Deletes everything (readings, preferences, mission, kv and collections). */
  reset(): Promise<void>;
}
