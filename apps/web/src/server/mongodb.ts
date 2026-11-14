import 'server-only';
import { type Db, MongoClient } from 'mongodb';
import { mongoDbName, mongoUri } from './mongo-env';

const globalForMongo = globalThis as unknown as { _mongoClient?: Promise<MongoClient> };

function getClient(): Promise<MongoClient> {
  if (!globalForMongo._mongoClient) {
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
