import { Suspense } from "react";
import { connection } from "next/server";
import { getDb } from "@/lib/mongodb";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AddItemForm } from "./add-item-form";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-6 sm:p-12">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">HAVEN</h1>
        <p className="text-muted-foreground">Next.js + shadcn/ui + MongoDB — misma API que iOS y watchOS.</p>
      </div>
      <AddItemForm />
      <Suspense fallback={<p className="text-muted-foreground">Cargando…</p>}>
        <ItemList />
      </Suspense>
    </main>
  );
}

// Datos en vivo desde Mongo: con cacheComponents, connection() marca este componente como dinámico.
async function ItemList() {
  await connection();
  const db = await getDb();
  const items = await db.collection("items").find().sort({ createdAt: -1 }).limit(50).toArray();

  return (
  <div className="flex flex-col gap-3">
    {items.map((item) => (
      <Card key={item._id.toString()}>
        <CardHeader>
          <CardTitle>{item.title}</CardTitle>
          <CardDescription>{new Date(item.createdAt).toLocaleString()}</CardDescription>
        </CardHeader>
      </Card>
    ))}
    {items.length === 0 && (
      <Card>
        <CardContent className="text-muted-foreground">Sin items todavía.</CardContent>
      </Card>
    )}
  </div>
  );
}
