'use client';

import { Merge } from 'lucide-react';
import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '@/components/ui/popover';
import { type Language, textsFor } from '@/lib/i18n';
import { mergeMissionAction } from '../actions';
import { texts } from '../i18n';
import { FormError } from './form-error';

type Target = { code: string; name: string };

function MergeTarget({ from, target, lang }: { from: string; target: Target; lang: Language }) {
  const [state, action, pending] = useActionState(
    mergeMissionAction.bind(null, from, target.code),
    { failed: false },
  );
  return (
    <form action={action}>
      <Button
        type="submit"
        variant="ghost"
        className="h-auto w-full justify-start gap-2 py-1.5"
        disabled={pending}
      >
        <span className="truncate">{target.name}</span>
      </Button>
      {state.failed ? (
        <FormError className="px-1 text-xs">{textsFor(texts, lang).mergeFailed}</FormError>
      ) : null}
    </form>
  );
}

export function MergeMission({
  from,
  targets,
  lang,
}: {
  from: string;
  targets: Target[];
  lang: Language;
}) {
  const t = textsFor(texts, lang);
  return (
    <Popover>
      <PopoverTrigger render={<Button variant="outline" size="sm" />}>
        <Merge data-icon="inline-start" />
        {t.merge}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <PopoverHeader>
          <PopoverTitle>{t.unknownCode}</PopoverTitle>
          <PopoverDescription>{t.unknownCodeHint}</PopoverDescription>
        </PopoverHeader>
        {targets.length ? (
          <div className="flex flex-col gap-1">
            <p className="text-muted-foreground px-1 text-xs">{t.mergeInto}</p>
            {targets.map((target) => (
              <MergeTarget key={target.code} from={from} target={target} lang={lang} />
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground text-xs">{t.mergeNone}</p>
        )}
      </PopoverContent>
    </Popover>
  );
}
