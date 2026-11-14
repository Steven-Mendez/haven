import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import type { CreateItemInput, Item } from "@haven/shared";

// API consumida por web, la app iOS y el Apple Watch.
export async function GET() {
  const db = await getDb();
  const docs = await db.collection("items").find().sort({ createdAt: -1 }).limit(100).toArray();
  const items: Item[] = docs.map((d) => ({
    _id: d._id.toString(),
    title: d.title,
    done: d.done ?? false,
    createdAt: new Date(d.createdAt).toISOString(),
  }));
  return NextResponse.json(items);
}

export async function POST(req: Request) {
  const body = (await req.json()) as Partial<CreateItemInput>;
  const title = body.title?.trim();
  if (!title) return NextResponse.json({ error: "title es requerido" }, { status: 400 });

  const db = await getDb();
  const doc = { title, done: false, createdAt: new Date() };
  const { insertedId } = await db.collection("items").insertOne(doc);
  return NextResponse.json(
    { _id: insertedId.toString(), ...doc, createdAt: doc.createdAt.toISOString() } satisfies Item,
    { status: 201 }
  );
}
