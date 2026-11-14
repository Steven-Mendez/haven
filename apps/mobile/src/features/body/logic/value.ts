export function formatValue(value: number, language: string): string {
  return value.toLocaleString(language, { maximumFractionDigits: 1 });
}
