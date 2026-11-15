import { KpiView } from '@/features/extras';

export default function Page({ searchParams }: PageProps<'/kpi'>) {
  return <KpiView searchParams={searchParams} />;
}
