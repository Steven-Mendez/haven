import type { CreateItemInput, Item } from '@pole-haven/shared';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

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
