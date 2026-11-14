import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { extrasRedirect } from '@/features/extras';

type Props = PageProps<'/extras'>;

/** Extras was split into /rules, /trends and /eva; old links keep working. */
export default function Page({ searchParams }: Props) {
  // The query is request data: reading it inside Suspense keeps the shell prerenderable.
  return (
    <Suspense fallback={null}>
      <Redirect searchParams={searchParams} />
    </Suspense>
  );
}

async function Redirect({ searchParams }: Pick<Props, 'searchParams'>): Promise<never> {
  const { tab, ...rest } = await searchParams;
  const query = new URLSearchParams(
    Object.entries(rest).flatMap(([k, v]) => (typeof v === 'string' ? [[k, v]] : [])),
  ).toString();
  redirect(`${extrasRedirect(tab)}${query ? `?${query}` : ''}`);
}
