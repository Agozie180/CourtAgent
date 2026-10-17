/** The date in the user's own time zone as YYYY-MM-DD. (`toISOString()` is UTC and is a day behind in Lagos after midnight.) */
export function localDateIso(now: Date = new Date()): string {
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

/** True for a real calendar date written as YYYY-MM-DD (rejects 2026-02-31 and 2026-13-01). */
export function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

/** The calendar date, in Lagos time, of a unix timestamp such as the registry's createdAt. */
export function lagosDateFromUnix(seconds: number): string {
  return new Date(seconds * 1000).toLocaleDateString("en-CA", { timeZone: "Africa/Lagos" });
}
