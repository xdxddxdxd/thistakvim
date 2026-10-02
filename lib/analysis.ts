import { addDays, dateObject, weekStart } from "./dates";
import type { Task } from "./types";

export type AnalysisTask = Pick<Task, "id" | "date" | "category_id" | "title" | "description" | "completed" | "position"> & { deleted_at?: string | null };
export type AnalysisStudyTime = { date: string; minutes: number };
export type AnalysisData = {
  tasks: AnalysisTask[];
  previous: AnalysisTask[];
  studyTimes: AnalysisStudyTime[];
  previousStudyTimes: AnalysisStudyTime[];
  asOf: string;
};
export const weekdays = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"];
export function validAnalysisDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = dateObject(value);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value && value >= "1900-01-01" && value <= "9998-12-31";
}
export function weekdayIndex(date: string) {
  return (dateObject(date).getUTCDay() + 6) % 7;
}
export function titleKey(title: string) {
  return title.normalize("NFC").trim().replace(/\s+/g, " ").toLocaleLowerCase("tr-TR");
}
export function taskCounts(tasks: AnalysisTask[]) {
  const total = tasks.length;
  const completed = tasks.filter((task) => task.completed).length;
  return { total, completed, remaining: total - completed, rate: total ? Math.round(completed / total * 100) : null };
}
export function studyTimeTotals(records: AnalysisStudyTime[]) {
  return {
    totalMinutes: records.length ? records.reduce((total, record) => total + record.minutes, 0) : null,
    recordedDays: records.length,
  };
}
export function analyzeStudyTime(input: AnalysisStudyTime[], asOf: string, start?: string) {
  const end = start ? addDays(start, 6) : undefined;
  const records = input.filter((record) => record.date <= asOf && (!start || (record.date >= start && record.date <= end!)));
  const daily = weekdays.map((name, index) => {
    const date = start ? addDays(start, index) : undefined;
    const rows = records.filter((record) => date ? record.date === date : weekdayIndex(record.date) === index);
    return { name, index, date, isFuture: !!date && date > asOf, ...studyTimeTotals(rows) };
  });
  return { records, ...studyTimeTotals(records), daily };
}
export function analyzeTasks(input: AnalysisTask[], start?: string) {
  const end = start ? addDays(start, 6) : undefined;
  const tasks = input.filter((task) => !task.deleted_at && (!start || (task.date >= start && task.date <= end!)));
  const daily = weekdays.map((name, index) => {
    const rows = tasks.filter((task) => weekdayIndex(task.date) === index);
    return { name, index, ...taskCounts(rows) };
  });
  const categoryGroups = new Map<string, AnalysisTask[]>();
  const titleGroups = new Map<string, AnalysisTask[]>();
  for (const task of tasks) {
    const category = categoryGroups.get(task.category_id) ?? [];
    category.push(task);
    categoryGroups.set(task.category_id, category);
    const key = titleKey(task.title);
    const titles = titleGroups.get(key) ?? [];
    titles.push(task);
    titleGroups.set(key, titles);
  }
  const categories = [...categoryGroups].map(([id, rows]) => ({ id, ...taskCounts(rows), days: weekdays.map((_, index) => rows.filter((task) => weekdayIndex(task.date) === index).length) })).sort((a, b) => b.total - a.total || a.id.localeCompare(b.id));
  const titles = [...titleGroups].map(([key, rows]) => ({ key, title: rows[0].title.trim().replace(/\s+/g, " "), categories: [...new Set(rows.map((task) => task.category_id))], ...taskCounts(rows) })).sort((a, b) => b.total - a.total || a.title.localeCompare(b.title, "tr"));
  return { tasks, ...taskCounts(tasks), daily, categories, titles };
}
export function weeklySummary(analysis: ReturnType<typeof analyzeTasks>, names: Record<string, string>) {
  if (!analysis.total) return "Bu hafta henüz görev yok. Planına görev eklediğinde haftanın özeti burada görünecek.";
  const parts = [`${analysis.total} görevin ${analysis.completed} tanesi tamamlandı; ${analysis.remaining} görev kaldı.`];
  const busiest = analysis.daily.filter((day) => day.total === Math.max(...analysis.daily.map((day) => day.total)));
  if (busiest.length < 7) parts.push(`En yoğun ${busiest.length === 1 ? "gün" : "günler"}: ${busiest.map((day) => day.name).join(", ")} (${busiest[0].total} görev${busiest.length > 1 ? " / gün" : ""}).`);
  const top = analysis.categories.filter((category) => category.total === analysis.categories[0].total);
  parts.push(`En çok yer verdiğin ${top.length === 1 ? "ders" : "dersler"}: ${top.map((category) => names[category.id] ?? "Diğer").join(", ")}.`);
  return parts.join(" ");
}
export function analysisStart(value: unknown, fallback: string) {
  return weekStart(validAnalysisDate(value) ? value : fallback);
}
