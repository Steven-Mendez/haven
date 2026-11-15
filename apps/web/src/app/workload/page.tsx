import { WorkloadView } from '@/features/extras';

export default function Page({ searchParams }: PageProps<'/workload'>) {
  return <WorkloadView searchParams={searchParams} />;
}
