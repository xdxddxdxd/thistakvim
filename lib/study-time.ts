import { isLocked, today } from "./dates";

export function canRecordStudyTime(date: string, finished: boolean, now = new Date()): boolean {
  return date === today(now) && !isLocked(date, finished, now);
}

export function studyMinutes(hours: unknown, minutes: unknown): number | null {
  if (typeof hours !== "number" || typeof minutes !== "number" ||
      !Number.isInteger(hours) || !Number.isInteger(minutes) ||
      hours < 0 || hours > 24 || minutes < 0 || minutes > 59) return null;
  const total = hours * 60 + minutes;
  return total <= 1440 ? total : null;
}
export function studyTimeLabel(total: number) {
  return `${Math.floor(total / 60)} saat ${total % 60} dakika`;
}
