'use client';

import { LogIn } from 'lucide-react';
import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { type Language, textsFor } from '@/lib/i18n';
import { joinMission } from '../actions';
import { texts } from '../i18n';
import type { JoinFormState } from '../types';
import { FormError, INVALID_INPUT } from './form-error';

const INITIAL: JoinFormState = { status: 'idle' };

/** «Join a mission» by its six-character code; sets the mission cookie and opens Crew. */
export function JoinMissionForm({
  lang,
  id,
  onCancel,
  className,
}: {
  lang: Language;
  id?: string;
  onCancel?: () => void;
  className?: string;
}) {
  const t = textsFor(texts, lang);
  const [state, action, pending] = useActionState(joinMission, INITIAL);
  const error =
    state.status === 'error' ? (state.code === 'format' ? t.errJoinCode : t.errJoinUnknown) : null;

  return (
    <Card id={id} className={className}>
      <CardHeader>
        <CardTitle>{t.joinTitle}</CardTitle>
        <CardDescription>{t.joinDescription}</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="flex flex-col gap-4">
          <Field>
            <FieldLabel htmlFor="join-code">{t.joinCode}</FieldLabel>
            <Input
              id="join-code"
              name="code"
              required
              maxLength={6}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              placeholder="ARES01"
              defaultValue={state.status === 'error' ? state.value : ''}
              key={state.status === 'error' ? state.value : 'empty'}
              aria-invalid={error ? true : undefined}
              className={`h-9 font-mono text-base tracking-widest uppercase ${INVALID_INPUT}`}
            />
            {error ? <FormError>{error}</FormError> : null}
          </Field>
          <div className="flex gap-2">
            <Button type="submit" disabled={pending}>
              <LogIn data-icon="inline-start" />
              {pending ? t.joining : t.join}
            </Button>
            {onCancel ? (
              <Button type="button" variant="ghost" onClick={onCancel}>
                {t.cancel}
              </Button>
            ) : null}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
