import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { extrasRedirect } from '@/features/extras';

type Props = PageProps<'/extras'>;

export default function Page({ searchParams }: Props) {
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
