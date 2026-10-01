import { addDays } from "./dates";
import type { Task, WeekData } from "./types";

export function applyTaskSnapshot(previous: WeekData, dates: string[], tasks: Task[], start: string): WeekData {
  const affected = new Set(dates);
  const end = addDays(start, 6);
  return { ...previous, tasks: [
    ...previous.tasks.filter((task) => !affected.has(task.date)),
    ...tasks.filter((task) => !task.deleted_at && task.date >= start && task.date <= end),
  ].sort((a, b) => a.position - b.position || a.id.localeCompare(b.id)) };
}
