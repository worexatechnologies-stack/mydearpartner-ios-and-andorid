/** Only explicit interest quota failures may disable sending for the day. */
export function isInterestQuotaError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const value = error as { code?: unknown; message?: unknown; detail?: unknown };
  if (typeof value.code === 'string' && /^(daily_)?interest(s)?_(limit|quota)_(reached|exceeded|exhausted)$/i.test(value.code)) {
    return true;
  }
  const text = [value.message, value.detail]
    .filter((part): part is string => typeof part === 'string')
    .join(' ');
  return /interest/i.test(text) &&
    /\b(limit|quota|allowance)\b/i.test(text) &&
    /\b(reached|exceeded|exhausted|used up|no remaining)\b/i.test(text);
}
