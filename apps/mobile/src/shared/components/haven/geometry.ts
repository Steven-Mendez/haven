// SVG geometry helpers. Angles in degrees, 0 = 12 o'clock, clockwise.

export function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = (deg * Math.PI) / 180;
  return { x: cx + r * Math.sin(rad), y: cy - r * Math.cos(rad) };
}

/** Open arc path from `fromDeg` to `toDeg` (clockwise). */
export function arcPath(cx: number, cy: number, r: number, fromDeg: number, toDeg: number): string {
  const sweep = Math.min(Math.max(toDeg - fromDeg, 0), 359.99);
  const a = polar(cx, cy, r, fromDeg);
  const b = polar(cx, cy, r, fromDeg + sweep);
  const large = sweep > 180 ? 1 : 0;
  return `M ${a.x} ${a.y} A ${r} ${r} 0 ${large} 1 ${b.x} ${b.y}`;
}

export const clamp01 = (v: number) => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0);
