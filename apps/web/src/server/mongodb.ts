import 'server-only';
import { type Db, MongoClient } from 'mongodb';
import { mongoDbName, mongoUri } from './mongo-env';

type CachedClient = { uri: string; client: Promise<MongoClient> };

const globalForMongo = globalThis as unknown as { _mongo?: CachedClient };

function getClient(): Promise<MongoClient> {
  const uri = mongoUri();
  const cached = globalForMongo._mongo;
  if (cached?.uri === uri) return cached.client;

  // La URI cambió (p. ej. MONGODB_USE_LOCAL en .env.local): cerrar el cliente anterior.
  if (cached) void cached.client.then((c) => c.close()).catch(() => {});

  const client = new MongoClient(uri, {
    // Atlas puede tardar >5 s en elegir primario desde redes con mucha latencia.
    serverSelectionTimeoutMS: 20000,
    connectTimeoutMS: 20000,
  })
    .connect()
    .catch((error) => {
      if (globalForMongo._mongo?.client === client) globalForMongo._mongo = undefined;
      throw error;
    });
  globalForMongo._mongo = { uri, client };
  return client;
}

export async function getDb(): Promise<Db> {
  return (await getClient()).db(mongoDbName());
}
