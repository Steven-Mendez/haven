'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

export function IndicatorSelect({
  options,
  selected,
  label,
}: {
  options: { id: string; name: string }[];
  selected: string;
  label: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const items = options.map((o) => ({ value: o.id, label: o.name }));

  return (
    <Select
      items={items}
      value={selected}
      onValueChange={(value) => {
        if (typeof value !== 'string') return;
        const next = new URLSearchParams(params.toString());
        next.set('indicator', value);
        startTransition(() => router.replace(`${pathname}?${next}`, { scroll: false }));
      }}
    >
      <SelectTrigger
        aria-label={label}
        className={cn('h-9 w-full sm:w-72', pending && 'opacity-70')}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {items.map((i) => (
          <SelectItem key={i.value} value={i.value}>
            {i.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
