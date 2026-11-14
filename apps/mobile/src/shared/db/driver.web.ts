import type { Reading } from '@haven/core';
import type { Collection, Database, KeyValue, KeyValueTable } from './types';

// Web build: expo-sqlite on web needs Metro to serve wasm with COOP/COEP headers (metro.config.js),
// so this stores into localStorage behind the same API. No SQL: `sqlite()` is null and
// `migrate()` is a no-op. If localStorage is full or missing, data stays in memory.

const PREFIX = 'haven:';
const memory = new Map<string, string>();

function read<T>(key: string, fallback: T): T {
  try {
    const text = globalThis.localStorage?.getItem(PREFIX + key) ?? memory.get(key);
    return text ? (JSON.parse(text) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  const text = JSON.stringify(value);
  memory.set(key, text);
  try {
    globalThis.localStorage?.setItem(PREFIX + key, text);
  } catch {
    // Quota exceeded: keep it in memory for this session.
  }
}

function keyValue(table: KeyValueTable): KeyValue {
  const all = () => read<Record<string, unknown>>(table, {});
  return {
    async get<T>(key: string) {
      return all()[key] as T | undefined;
    },
    async set<T>(key: string, value: T) {
      write(table, { ...all(), [key]: value });
    },
    async remove(key: string) {
      const { [key]: _removed, ...rest } = all();
      write(table, rest);
    },
    async all() {
      return all();
    },
  };
}

function collection<T>(name: string): Collection<T> {
  const key = `col_${name}`;
  const map = () => read<Record<string, T>>(key, {});
  return {
    async all() {
      return Object.values(map());
    },
    async get(id) {
      return map()[id];
    },
    async put(id, value) {
      write(key, { ...map(), [id]: value });
    },
    async remove(id) {
      const { [id]: _removed, ...rest } = map();
      write(key, rest);
    },
    async clear() {
      write(key, {});
    },
  };
}

const readings: Database['readings'] = {
  async all() {
    return read<Reading[]>('readings', []);
  },
  async put(items) {
    if (items.length === 0) return;
    const byId = new Map(read<Reading[]>('readings', []).map((r) => [r.id, r]));
    for (const r of items) byId.set(r.id, r);
    write(
      'readings',
      [...byId.values()].sort((a, b) => a.takenAt.localeCompare(b.takenAt)),
    );
  },
  async remove(removeIds) {
    const gone = new Set(removeIds);
    write(
      'readings',
      read<Reading[]>('readings', []).filter((r) => !gone.has(r.id)),
    );
  },
  async clear() {
    write('readings', []);
  },
};

export const db: Database = {
  driver: 'web',
  open: async () => {},
  sqlite: () => null,
  migrate: async () => {},
  keyValue,
  collection,
  readings,
  async reset() {
    memory.clear();
    try {
      const storage = globalThis.localStorage;
      if (!storage) return;
      for (const key of Object.keys(storage)) {
        if (key.startsWith(PREFIX)) storage.removeItem(key);
      }
    } catch {
      // nothing to delete
    }
  },
};
