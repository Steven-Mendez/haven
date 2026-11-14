import 'server-only';
import { type Db, MongoClient } from 'mongodb';
import { mongoDbName, mongoUri } from './mongo-env';

// One client per process: reused across HMR in development and across invocations in serverless.
const globalForMongo = globalThis as unknown as { _mongoClient?: Promise<MongoClient> };

function getClient(): Promise<MongoClient> {
  if (!globalForMongo._mongoClient) {
    // A failed connection is dropped so the next request retries instead of reusing the rejection.
    globalForMongo._mongoClient = new MongoClient(mongoUri(), { serverSelectionTimeoutMS: 5000 })
      .connect()
      .catch((error) => {
        globalForMongo._mongoClient = undefined;
        throw error;
      });
  }
  return globalForMongo._mongoClient;
}

export async function getDb(): Promise<Db> {
  return (await getClient()).db(mongoDbName());
}
