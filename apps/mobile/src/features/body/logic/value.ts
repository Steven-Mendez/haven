// Value formatting for indicator cards: at most one decimal, locale separator.

export function formatValue(value: number, language: string): string {
  return value.toLocaleString(language, { maximumFractionDigits: 1 });
}
