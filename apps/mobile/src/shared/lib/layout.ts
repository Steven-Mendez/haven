import { useWindowDimensions } from 'react-native';

export const BASE_WIDTH = 402;

const LARGE_WIDTH = 430;

export function useLayout() {
  const { width } = useWindowDimensions();
  return { width, scale: width / BASE_WIDTH, compact: width < LARGE_WIDTH };
}
