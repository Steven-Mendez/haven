import { View } from 'react-native';
import { cn } from '@/shared/lib/utils';

function Skeleton({
  className,
  ...props
}: React.ComponentProps<typeof View> & React.RefAttributes<View>) {
  return <View className={cn('bg-muted rounded-sm', className)} {...props} />;
}

export { Skeleton };
