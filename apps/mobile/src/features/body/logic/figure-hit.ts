export const FIGURE_VIEWBOX = { width: 240, height: 440 } as const;

export const SMALL_ZONE_CENTERS: Record<string, { x: number; y: number }> = {
  mind: { x: 120, y: 24 },
  vitals: { x: 146, y: 172 },
};

export type HitBox = { zone: string; left: number; top: number; size: number };

export function hitBoxes(height: number, size = 48): HitBox[] {
  const scale = height / FIGURE_VIEWBOX.height;
  const side = Math.max(48, size);
  return Object.entries(SMALL_ZONE_CENTERS).map(([zone, c]) => ({
    zone,
    left: c.x * scale - side / 2,
    top: c.y * scale - side / 2,
    size: side,
  }));
}

export function figureWidth(height: number): number {
  return (height * FIGURE_VIEWBOX.width) / FIGURE_VIEWBOX.height;
}
