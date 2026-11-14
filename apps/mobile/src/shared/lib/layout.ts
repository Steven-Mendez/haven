import { useWindowDimensions } from 'react-native';

/** Width the layout is tuned for: iPhone 17 / 18 (402 pt). */
export const BASE_WIDTH = 402;

/** Pro Max / Plus phones (430–440 pt) and wider. */
const LARGE_WIDTH = 430;

/**
 * Screen-width aware sizing. `scale` grows hero elements (rings, body figure) on wider phones;
 * `compact` is true below Pro Max width, where dense rows tighten gaps so names stay on one line.
 */
export function useLayout() {
  const { width } = useWindowDimensions();
  return { width, scale: width / BASE_WIDTH, compact: width < LARGE_WIDTH };
}
