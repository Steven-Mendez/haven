export function formatNumber(value: number, language: string): string {
  const abs = Math.abs(value);
  const digits = abs !== 0 && abs < 10 && !Number.isInteger(value * 10) ? 2 : 1;
  return value.toLocaleString(language, { maximumFractionDigits: digits });
}

export function formatRange([low, high]: [number, number], language: string): string {
  return `${formatNumber(low, language)}–${formatNumber(high, language)}`;
}
