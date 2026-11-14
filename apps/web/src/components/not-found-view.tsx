import { Compass } from 'lucide-react';
import Link from 'next/link';
import { EmptyState, havenTexts, PageContainer } from '@/components/haven';
import { buttonVariants } from '@/components/ui/button';
import { getLanguage } from '@/lib/language';

/** 404 inside the shell, in the reader's language (minimal empty state, SPEC §6 «Estados»). */
export async function NotFoundView() {
  const t = havenTexts[await getLanguage()];
  return (
    <PageContainer className="justify-center">
      <EmptyState
        icon={<Compass />}
        title={t.notFoundTitle}
        description={t.notFoundDescription}
        className="mx-auto w-full max-w-md border-0"
        action={
          <Link href="/" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            {t.backToCrew}
          </Link>
        }
      />
    </PageContainer>
  );
}
