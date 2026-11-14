import 'server-only';
import type { Collection, Db, Document } from 'mongodb';
import { COLLECTIONS, INDEXES, type MissionDoc, type PacketDoc, type RulesDoc } from './model';
import { getDb } from './mongodb';

// T01 backend · MongoDB collections. Indexes are created once per process.
//   packets   · Packet + receivedAt + dataAt + recomputed visibleAt (unique by id)
//   missions  · Mission + name + start + durationDays (unique by code)
//   rules     · config versions with sentAt, visibleAt, appliedAt

const globalIndexes = globalThis as unknown as { _havenIndexes?: Promise<void> };

async function ensureIndexes(db: Db) {
  await Promise.all(
    Object.entries(INDEXES).flatMap(([name, indexes]) =>
      indexes.map((i) => db.collection(name).createIndex(i.key, i.unique ? { unique: true } : {})),
    ),
  );
}

async function collection<T extends Document>(name: string): Promise<Collection<T>> {
  const db = await getDb();
  globalIndexes._havenIndexes ??= ensureIndexes(db).catch((error) => {
    globalIndexes._havenIndexes = undefined;
    throw error;
  });
  await globalIndexes._havenIndexes;
  return db.collection<T>(name);
}

/** Packets received from the phone. Only those with visibleAt <= now are ever shown. */
export const packets = () => collection<PacketDoc>(COLLECTIONS.packets);
export const missions = () => collection<MissionDoc>(COLLECTIONS.missions);
export const rules = () => collection<RulesDoc>(COLLECTIONS.rules);
