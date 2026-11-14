// Where MongoDB lives. Atlas by default (`MONGODB_URI`, the same variable Vercel has);
// `MONGODB_USE_LOCAL=true` switches to the Docker container (`pnpm db:up`).
// Plain module (no `server-only`) so scripts/ can share it.

export function mongoUri(): string {
  const useLocal = process.env.MONGODB_USE_LOCAL === 'true';
  const uri = useLocal
    ? (process.env.MONGODB_LOCAL_URI ?? 'mongodb://localhost:27017')
    : process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('Missing MONGODB_URI. Copy apps/web/.env.example to .env.local.');
  }
  return uri;
}

export function mongoDbName(): string {
  return process.env.MONGODB_DB ?? 'haven';
}
