import { redirect } from 'next/navigation';
import { Suspense } from 'react';

type Props = PageProps<'/trends'>;

export default function Page({ searchParams }: Props) {
  return (
    <Suspense fallback={null}>
      <Redirect searchParams={searchParams} />
    </Suspense>
  );
}

async function Redirect({ searchParams }: Pick<Props, 'searchParams'>): Promise<never> {
  const params = await searchParams;
  const query = new URLSearchParams(
    Object.entries(params).flatMap(([k, v]) => (typeof v === 'string' ? [[k, v]] : [])),
  );
  if (query.has('indicator') && !query.has('view')) query.set('view', 'individual');
  query.delete('tab');
  const text = query.toString();
  redirect(`/kpi${text ? `?${text}` : ''}`);
}
