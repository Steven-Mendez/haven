import { ExerciseView } from '@/features/extras';

export default function Page({ searchParams }: PageProps<'/exercise'>) {
  return <ExerciseView searchParams={searchParams} />;
}
