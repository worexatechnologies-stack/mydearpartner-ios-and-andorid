/** Parse a real calendar date, using local calendar days (not elapsed milliseconds). */
export function adultDateOfBirth(
  input: string,
  today = new Date(),
): string | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(input.trim());
  if (!match) return null;
  const [, dd, mm, yyyy] = match;
  const day = Number(dd),
    month = Number(mm),
    year = Number(yyyy);
  const birth = new Date(year, month - 1, day);
  if (
    birth.getFullYear() !== year ||
    birth.getMonth() !== month - 1 ||
    birth.getDate() !== day
  )
    return null;
  const age =
    today.getFullYear() -
    year -
    (today.getMonth() < month - 1 ||
    (today.getMonth() === month - 1 && today.getDate() < day)
      ? 1
      : 0);
  return age >= 18 && age <= 120 ? `${yyyy}-${mm}-${dd}` : null;
}
