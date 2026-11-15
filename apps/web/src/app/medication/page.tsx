import { MedicationView } from '@/features/extras';

export default function Page({ searchParams }: PageProps<'/medication'>) {
  return <MedicationView searchParams={searchParams} />;
}
