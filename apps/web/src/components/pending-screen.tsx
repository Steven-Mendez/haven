import { Badge } from '@/components/ui/badge';

type Props = { id: string; title: string; description?: string };

export function PendingScreen({ id, title, description }: Props) {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-3 p-8">
      <Badge variant="secondary" className="w-fit">
        {id}
      </Badge>
      <h1 className="text-xl font-semibold">{title}</h1>
      {description ? <p className="text-muted-foreground">{description}</p> : null}
    </main>
  );
}
