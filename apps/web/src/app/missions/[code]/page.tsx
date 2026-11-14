import { MissionView } from '@/features/extras';

export default function Page({ params }: PageProps<'/missions/[code]'>) {
  return <MissionView params={params} />;
}
