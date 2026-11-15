import { MotionView } from '@/features/extras';

export default function Page({ searchParams }: PageProps<'/motion'>) {
  return <MotionView searchParams={searchParams} />;
}
