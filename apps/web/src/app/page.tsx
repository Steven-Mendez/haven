import { View } from '@/features/crew';

export default function Page({ searchParams }: PageProps<'/'>) {
  return <View searchParams={searchParams} />;
}
