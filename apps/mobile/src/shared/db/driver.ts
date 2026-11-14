import type { Reading } from '@haven/core';
import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';
import type { Collection, Database, KeyValue, KeyValueTable } from './types';

// iOS and Android: expo-sqlite. The web uses driver.web.ts (localStorage), because expo-sqlite on
// web needs Metro to serve wasm with COOP/COEP headers (metro.config.js).

const NAME = 'haven.db';

let database: SQLiteDatabase | null = null;
let queued: SQLiteDatabase | null = null;

// Single write queue: every write (run, exec, transaction, migration) goes through it, one at a
// time, on the one connection. `withExclusiveTransactionAsync` opens a second connection and,
// with concurrent writers, ends in «database is locked»; inside this queue a plain
// `withTransactionAsync` is safe because nothing else writes meanwhile. Reads are not queued.
let writes: Promise<unknown> = Promise.resolve();
function write<T>(task: () => Promise<T>): Promise<T> {
  const next = writes.then(task, task);
  writes = next.catch(() => undefined);
  return next;
}

const WRITE_METHODS = new Set([
  'runAsync',
  'execAsync',
  'withTransactionAsync',
  'withExclusiveTransactionAsync',
]);

/** `db.sqlite()` for features: same object, but its async writes go through the write queue. */
function queuedDatabase(sql: SQLiteDatabase): SQLiteDatabase {
  return new Proxy(sql, {
    get(target, key, receiver) {
      const value = Reflect.get(target, key, receiver);
      if (typeof value !== 'function') return value;
      if (key === 'withExclusiveTransactionAsync' || key === 'withTransactionAsync') {
        // Inside the queue the transaction is already exclusive for writers: use the same connection.
        return (task: (txn: SQLiteDatabase) => Promise<void>) =>
          write(() => target.withTransactionAsync(() => task(target)));
      }
      if (WRITE_METHODS.has(String(key))) {
        return (...args: unknown[]) => write(() => value.apply(target, args));
      }
      return value.bind(target);
    },
  });
}
let opening: Promise<void> | null = null;
const createdCollections = new Set<string>();

function required(): SQLiteDatabase {
  if (!database) throw new Error('db: call db.open() before using the database');
  return database;
}

function safeName(name: string) {
  if (!/^[a-z0-9_]+$/i.test(name)) throw new Error(`db: invalid table name: ${name}`);
  return name;
}

async function migrate(table: string, steps: string[]) {
  const sql = required();
  safeName(table);
  const row = await sql.getFirstAsync<{ version: number }>(
    'SELECT version FROM _migrations WHERE tableName = ?',
    table,
  );
  const version = row?.version ?? 0;
  if (version >= steps.length) return;
  await write(() =>
    sql.withTransactionAsync(async () => {
      for (let i = version; i < steps.length; i++) await sql.execAsync(steps[i] as string);
      await sql.runAsync(
        'INSERT INTO _migrations (tableName, version) VALUES (?, ?) ON CONFLICT(tableName) DO UPDATE SET version = excluded.version',
        table,
        steps.length,
      );
    }),
  );
}

const keyValueTable = (table: KeyValueTable) =>
  `CREATE TABLE IF NOT EXISTS ${table} (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL)`;

async function open() {
  if (database) return;
  opening ??= (async () => {
    const sql = await openDatabaseAsync(NAME);
    await sql.execAsync(`
      PRAGMA journal_mode = WAL;
      PRAGMA busy_timeout = 5000;
      CREATE TABLE IF NOT EXISTS _migrations (tableName TEXT PRIMARY KEY NOT NULL, version INTEGER NOT NULL);
    `);
    database = sql;
    queued = queuedDatabase(sql);
    await migrate('readings', [
      `CREATE TABLE IF NOT EXISTS readings (
        id TEXT PRIMARY KEY NOT NULL,
        indicator TEXT NOT NULL,
        crewMember TEXT NOT NULL,
        takenAt TEXT NOT NULL,
        source TEXT NOT NULL,
        simulated INTEGER NOT NULL,
        data TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS readings_by_indicator ON readings (crewMember, indicator, takenAt);`,
    ]);
    await migrate('preferences', [keyValueTable('preferences')]);
    await migrate('mission', [keyValueTable('mission')]);
    await migrate('kv', [keyValueTable('kv')]);
  })();
  await opening;
}

function keyValue(table: KeyValueTable): KeyValue {
  return {
    async get<T>(key: string) {
      const row = await required().getFirstAsync<{ value: string }>(
        `SELECT value FROM ${table} WHERE key = ?`,
        key,
      );
      return row ? (JSON.parse(row.value) as T) : undefined;
    },
    async set<T>(key: string, value: T) {
      const sql = required();
      await write(() =>
        sql.runAsync(
          `INSERT INTO ${table} (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
          key,
          JSON.stringify(value),
        ),
      );
    },
    async remove(key: string) {
      const sql = required();
      await write(() => sql.runAsync(`DELETE FROM ${table} WHERE key = ?`, key));
    },
    async all() {
      const rows = await required().getAllAsync<{ key: string; value: string }>(
        `SELECT key, value FROM ${table}`,
      );
      return Object.fromEntries(rows.map((r) => [r.key, JSON.parse(r.value)]));
    },
  };
}

function collection<T>(name: string): Collection<T> {
  const table = `col_${safeName(name)}`;
  const ready = async () => {
    if (!createdCollections.has(table)) {
      await migrate(table, [
        `CREATE TABLE IF NOT EXISTS ${table} (id TEXT PRIMARY KEY NOT NULL, data TEXT NOT NULL, updatedAt TEXT NOT NULL)`,
      ]);
      createdCollections.add(table);
    }
    return required();
  };
  return {
    async all() {
      const rows = await (await ready()).getAllAsync<{ data: string }>(
        `SELECT data FROM ${table} ORDER BY rowid`,
      );
      return rows.map((r) => JSON.parse(r.data) as T);
    },
    async get(id) {
      const row = await (await ready()).getFirstAsync<{ data: string }>(
        `SELECT data FROM ${table} WHERE id = ?`,
        id,
      );
      return row ? (JSON.parse(row.data) as T) : undefined;
    },
    async put(id, value) {
      const sql = await ready();
      await write(() =>
        sql.runAsync(
          `INSERT INTO ${table} (id, data, updatedAt) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data, updatedAt = excluded.updatedAt`,
          id,
          JSON.stringify(value),
          new Date().toISOString(),
        ),
      );
    },
    async remove(id) {
      const sql = await ready();
      await write(() => sql.runAsync(`DELETE FROM ${table} WHERE id = ?`, id));
    },
    async clear() {
      const sql = await ready();
      await write(() => sql.runAsync(`DELETE FROM ${table}`));
    },
  };
}

const readings: Database['readings'] = {
  async all() {
    const rows = await required().getAllAsync<{ data: string }>(
      'SELECT data FROM readings ORDER BY takenAt',
    );
    return rows.map((r) => JSON.parse(r.data) as Reading);
  },
  async put(items) {
    if (items.length === 0) return;
    const sql = required();
    await write(() =>
      sql.withTransactionAsync(async () => {
        const statement = await sql.prepareAsync(
          'INSERT OR REPLACE INTO readings (id, indicator, crewMember, takenAt, source, simulated, data) VALUES (?, ?, ?, ?, ?, ?, ?)',
        );
        try {
          for (const r of items) {
            await statement.executeAsync(
              r.id,
              r.indicator,
              r.crewMember,
              r.takenAt,
              r.source,
              r.simulated ? 1 : 0,
              JSON.stringify(r),
            );
          }
        } finally {
          await statement.finalizeAsync();
        }
      }),
    );
  },
  async remove(removeIds) {
    if (removeIds.length === 0) return;
    const sql = required();
    const marks = removeIds.map(() => '?').join(', ');
    await write(() => sql.runAsync(`DELETE FROM readings WHERE id IN (${marks})`, removeIds));
  },
  async clear() {
    const sql = required();
    await write(() => sql.runAsync('DELETE FROM readings'));
  },
};

async function reset() {
  const sql = required();
  const tables = await sql.getAllAsync<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'col_%'",
  );
  await write(() =>
    sql.execAsync(
      [
        'DELETE FROM readings',
        'DELETE FROM preferences',
        'DELETE FROM mission',
        'DELETE FROM kv',
        ...tables.map((t) => `DELETE FROM ${t.name}`),
      ].join(';\n'),
    ),
  );
}

export const db: Database = {
  driver: 'sqlite',
  open,
  sqlite: () => queued,
  migrate,
  keyValue,
  collection,
  readings,
  reset,
};
