function normalizedLocation(value?: string): string {
  const normalized = (value ?? '')
    .trim()
    .toLocaleLowerCase()
    .replace(/[\s_-]+/g, '');
  return normalized === 'bengaluru' ? 'bangalore' : normalized;
}

export function sameProfileCity(first?: string, second?: string): boolean {
  const city = normalizedLocation(first);
  return !!city && city === normalizedLocation(second);
}
