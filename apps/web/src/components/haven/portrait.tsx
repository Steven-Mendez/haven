import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

export function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

type Props = {
  id?: string;
  name: string;
  src?: string | null;
  size?: number;
  className?: string;
};

export function Portrait({ name, src, size = 56, className }: Props) {
  const url = src ?? undefined;
  return (
    <span
      className={cn('relative inline-flex shrink-0', className)}
      style={{ width: size, height: size }}
    >
      <Avatar className="size-full rounded-lg after:rounded-lg">
        {url ? <AvatarImage src={url} alt={name} className="rounded-lg" /> : null}
        <AvatarFallback
          className="numeric rounded-lg font-semibold"
          style={{ fontSize: Math.round(size * 0.36) }}
        >
          {initials(name)}
        </AvatarFallback>
      </Avatar>
    </span>
  );
}
