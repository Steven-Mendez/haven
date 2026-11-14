// Local database (M00). iOS and Android: expo-sqlite (`haven.db`) with tables readings,
// preferences, mission and kv. Web: localStorage behind the same API (see driver.web.ts).
//
// New tables (e.g. the M09 queue):
//   const queue = db.collection<Packet>('queue');       // works on every platform
//   await queue.put(p.id, p); await queue.all();
// or, native only, your own SQL with per-table migrations:
//   await db.migrate('queue', ['CREATE TABLE …', 'ALTER TABLE …']); db.sqlite()?.runAsync(…)
export { db } from './driver';
export type { Collection, Database, KeyValue, KeyValueTable } from './types';
