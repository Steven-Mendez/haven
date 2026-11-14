import { MongoClient, type Db } from "mongodb";

// MONGODB_USE_LOCAL=true → Mongo local de Docker; si no, MONGODB_URI (Atlas).
const useLocal = process.env.MONGODB_USE_LOCAL === "true";
const uri = useLocal
  ? process.env.MONGODB_LOCAL_URI ?? "mongodb://localhost:27017"
  : process.env.MONGODB_URI;
if (!uri) throw new Error("Falta MONGODB_URI en apps/web/.env.local");

// Reutiliza la conexión entre hot-reloads en dev y entre invocaciones en serverless.
const globalForMongo = globalThis as unknown as { _mongoClient?: Promise<MongoClient> };

function getClient(): Promise<MongoClient> {
  if (!globalForMongo._mongoClient) {
    // Si la conexión falla, se descarta para reintentar en la próxima request.
    globalForMongo._mongoClient = new MongoClient(uri!).connect().catch((err) => {
      globalForMongo._mongoClient = undefined;
      throw err;
    });
  }
  return globalForMongo._mongoClient;
}

export async function getDb(): Promise<Db> {
  const client = await getClient();
  return client.db(process.env.MONGODB_DB ?? "haven");
}
