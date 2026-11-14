'use client';

import { useActionState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { type Language, textsFor } from '@/lib/i18n';
import { renameMissionAction } from '../actions';
import { texts } from '../i18n';
import { FormError } from './form-error';

/** The mission name, editable in place until the mission is finished. */
export function RenameMission({
  code,
  name,
  disabled,
  lang,
}: {
  code: string;
  name: string;
  disabled: boolean;
  lang: Language;
}) {
  const t = textsFor(texts, lang);
  const [state, action, pending] = useActionState(renameMissionAction.bind(null, code), {
    failed: false,
  });
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (!state.failed) toast.success(t.renameSaved);
  }, [state, t.renameSaved]);
  return (
    <form action={action} className="flex flex-col gap-2">
      <div className="flex gap-2">
        <Input
          name="name"
          required
          maxLength={80}
          defaultValue={name}
          disabled={disabled}
          aria-label={t.sectionName}
          className="h-9"
        />
        {disabled ? null : (
          <Button type="submit" variant="outline" disabled={pending}>
            {t.renameSave}
          </Button>
        )}
      </div>
      {state.failed ? <FormError>{t.missionActionFailed}</FormError> : null}
    </form>
  );
}
