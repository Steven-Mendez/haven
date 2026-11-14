import { TimeAgo } from '@/components/haven';
import { Card, CardContent } from '@/components/ui/card';
import { format, formatDateTime, type Language } from '@/lib/i18n';
import type { ReceivedPacket } from '@/server/types';
import type { AstronautTexts } from '../i18n';
import { NOTE_ENTRIES_SHOWN, noteEntries } from '../logic';

const KIND_LABEL = {
  notes: 'notes',
  diary: 'diary',
  readingNote: 'readingNote',
  photoNote: 'photoNote',
} as const;

/** Notes, diary entries and reading/photo notes the astronaut sent, newest first. */
export function NotesList({
  packets,
  lang,
  t,
}: {
  packets: ReceivedPacket[];
  lang: Language;
  t: AstronautTexts;
}) {
  const entries = noteEntries(packets);
  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        {entries.length ? (
          <ul className="flex flex-col divide-y">
            {entries.slice(0, NOTE_ENTRIES_SHOWN).map((e) => (
              <li key={e.id} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0">
                <span className="text-muted-foreground flex flex-wrap items-center gap-x-2 text-xs">
                  <span className="text-foreground font-medium">{t[KIND_LABEL[e.kind]]}</span>
                  <span aria-hidden="true">·</span>
                  <TimeAgo at={e.at} lang={lang}>
                    {formatDateTime(e.at, lang)}
                  </TimeAgo>
                </span>
                <p className="text-sm whitespace-pre-line">{e.text}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground text-sm">{t.notesEmpty}</p>
        )}
        {entries.length > NOTE_ENTRIES_SHOWN ? (
          <p className="text-muted-foreground text-xs">
            {format(t.notesShowing, { shown: NOTE_ENTRIES_SHOWN, total: entries.length })}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
