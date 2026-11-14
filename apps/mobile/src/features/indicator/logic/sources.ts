// Guide sources (P02) come as «Title: https://…». Split them so the screen shows a titled link.

export type GuideSource = { title: string; url?: string };

export function parseSource(source: string): GuideSource {
  const match = source.match(/^(.*?):?\s*(https?:\/\/\S+)\s*$/);
  if (!match) return { title: source.trim() };
  const url = match[2] as string;
  const title = (match[1] ?? '').trim().replace(/[:,\s]+$/, '');
  return { title: title || hostOf(url), url };
}

function hostOf(url: string): string {
  return url.replace(/^https?:\/\//, '').split('/')[0] ?? url;
}
