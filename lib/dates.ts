export const TIMEZONE = "Europe/Istanbul";
export const TYT_EXAM_DATE = "2027-06-19";
const todayFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit",
});
const timeFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: TIMEZONE, hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});
const labelFormatters = new Map<string, Intl.DateTimeFormat>();
export function today(now = new Date()): string {
  return todayFormatter.format(now);
}
export function dateObject(value: string) {
  return new Date(`${value}T12:00:00Z`);
}
export function tytDaysRemaining(currentDate = today()): number {
  return Math.max(0, Math.round(
    (dateObject(TYT_EXAM_DATE).getTime() - dateObject(currentDate).getTime()) / 86400000,
  ));
}
export function addDays(value: string, count: number): string {
  const date = dateObject(value);
  date.setUTCDate(date.getUTCDate() + count);
  return date.toISOString().slice(0, 10);
}
export function weekStart(value: string): string {
  const day = dateObject(value).getUTCDay();
  return addDays(value, -(day === 0 ? 6 : day - 1));
}
export function weekDates(value: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(value, i));
}
export function dateLabel(
  value: string,
  options: Intl.DateTimeFormatOptions,
): string {
  const key = JSON.stringify(options);
  let formatter = labelFormatters.get(key);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("tr-TR", { timeZone: "UTC", ...options });
    labelFormatters.set(key, formatter);
  }
  return formatter.format(dateObject(value));
}
export function weekLabel(start: string): string {
  const end = addDays(start, 6);
  const a = dateObject(start);
  const b = dateObject(end);
  if (a.getUTCFullYear() !== b.getUTCFullYear())
    return `${dateLabel(start, { day: "numeric", month: "short", year: "numeric" })} – ${dateLabel(end, { day: "numeric", month: "short", year: "numeric" })}`;
  if (a.getUTCMonth() !== b.getUTCMonth())
    return `${dateLabel(start, { day: "numeric", month: "short" })} – ${dateLabel(end, { day: "numeric", month: "short", year: "numeric" })}`;
  return `${a.getUTCDate()} – ${dateLabel(end, { day: "numeric", month: "long", year: "numeric" })}`;
}
export function isLocked(
  date: string,
  finished: boolean,
  now = new Date(),
): boolean {
  const current = today(now);
  if (date < current || (date > current && finished)) return true;
  const time = timeFormatter.format(now);
  return date === current && time >= "23:59";
}
