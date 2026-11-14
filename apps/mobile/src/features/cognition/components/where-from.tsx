import { useState } from 'react';
import { OriginLink } from '@/shared/components/haven';
import { Card, CardContent } from '@/shared/components/ui/card';
import { Text } from '@/shared/components/ui/text';

/** «¿De dónde sale este dato?» link that unfolds its answer in place (no modal). */
export function WhereFrom({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <OriginLink onPress={() => setOpen((v) => !v)} />
      {open ? (
        <Card className="rounded-lg py-4 shadow-none">
          <CardContent>
            <Text className="text-body text-muted-foreground">{text}</Text>
          </CardContent>
        </Card>
      ) : null}
    </>
  );
}
