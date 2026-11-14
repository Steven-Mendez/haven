// Glove-sized hit targets over the body figure (QA: «Mind» 44×13 pt and «Heart» 26×25 pt were
// too small). `BodyFigure` draws in a 240 × 440 viewBox; these centres mirror its mind waves and
// heart shape. Lyra owns the figure: if she adds ≥ 48 pt targets inside it, this overlay goes.

export const FIGURE_VIEWBOX = { width: 240, height: 440 } as const;

/** Centre (viewBox units) of the zones whose drawn shape is smaller than a gloved finger. */
export const SMALL_ZONE_CENTERS: Record<string, { x: number; y: number }> = {
  mind: { x: 120, y: 24 },
  heart: { x: 146, y: 172 },
};

export type HitBox = { zone: string; left: number; top: number; size: number };

/** Square boxes of `size` pt (≥ 48) centred on each small zone, for a figure of `height` pt. */
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

/** Width of the figure in pt for a given height (same aspect ratio as the viewBox). */
export function figureWidth(height: number): number {
  return (height * FIGURE_VIEWBOX.width) / FIGURE_VIEWBOX.height;
}
