import { MongoClient, type Db } from "mongodb";

// MONGODB_USE_LOCAL=true → Mongo local de Docker; si no, MONGODB_URI (Atlas).
const useLocal = process.env.MONGODB_USE_LOCAL === "true";
const uri = useLocal
  ? process.env.MONGODB_LOCAL_URI ?? "mongodb://localhost:27017"
  : process.env.MONGODB_URI;
if (!uri) throw new Error("Falta MONGODB_URI en apps/web/.env.local");

// Reutiliza la conexión entre hot-reloads en dev y entre invocaciones en serverless.
const globalForMongo = globalThis as unknown as { _mongoClient?: Promise<MongoClient> };

const clientPromise =
  globalForMongo._mongoClient ?? (globalForMongo._mongoClient = new MongoClient(uri).connect());

export async function getDb(): Promise<Db> {
  const client = await clientPromise;
  return client.db(process.env.MONGODB_DB ?? "haven");
}
