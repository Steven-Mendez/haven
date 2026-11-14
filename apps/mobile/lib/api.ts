import type { CreateItemInput, Item } from '@haven/shared';

// EXPO_PUBLIC_USE_LOCAL_API=true → API local; si no, la de Vercel.
const API_URL =
  process.env.EXPO_PUBLIC_USE_LOCAL_API === 'true'
    ? process.env.EXPO_PUBLIC_LOCAL_API_URL ?? 'http://localhost:3000'
    : process.env.EXPO_PUBLIC_API_URL;

if (!API_URL) {
  throw new Error('Falta EXPO_PUBLIC_API_URL en apps/mobile/.env (o usa EXPO_PUBLIC_USE_LOCAL_API=true)');
}

export async function getItems(): Promise<Item[]> {
  const res = await fetch(`${API_URL}/api/items`);
  if (!res.ok) throw new Error(`GET /api/items ${res.status}`);
  return res.json();
}

export async function createItem(input: CreateItemInput): Promise<Item> {
  const res = await fetch(`${API_URL}/api/items`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`POST /api/items ${res.status}`);
  return res.json();
}
