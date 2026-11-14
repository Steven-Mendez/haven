import { MongoClient, type Db } from "mongodb";

const uri = process.env.MONGODB_URI;
if (!uri) throw new Error("Falta MONGODB_URI en apps/web/.env.local");

// Reutiliza la conexión entre hot-reloads en dev y entre invocaciones en serverless.
const globalForMongo = globalThis as unknown as { _mongoClient?: Promise<MongoClient> };

const clientPromise =
  globalForMongo._mongoClient ?? (globalForMongo._mongoClient = new MongoClient(uri).connect());

export async function getDb(): Promise<Db> {
  const client = await clientPromise;
  return client.db(process.env.MONGODB_DB ?? "haven");
}
