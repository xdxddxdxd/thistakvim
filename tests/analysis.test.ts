import assert from "node:assert/strict";
import { test } from "node:test";
import { analyzeTasks, taskCounts, titleKey, validAnalysisDate, weeklySummary, type AnalysisTask } from "../lib/analysis";
const task = (id: string, date: string, completed = false, extra: Partial<AnalysisTask> = {}): AnalysisTask => ({ id, date, completed, category_id: "math", title: "Problemler", description: "", position: 1, ...extra });

test("week stats exclude other weeks and deleted tasks; remaining tasks are not inferred from day closure", () => {
  const stats = analyzeTasks([
    task("1", "2026-09-28", true), task("2", "2026-09-28"), task("3", "2026-10-04"),
    task("4", "2026-09-27"), task("5", "2026-10-05"), task("6", "2026-10-01", false, { deleted_at: "2026-10-01" }),
  ], "2026-09-28");
  assert.deepEqual([stats.total, stats.completed, stats.remaining, stats.rate], [3, 1, 2, 33]);
  assert.equal(stats.daily[0].total, 2);
  assert.equal(stats.daily[6].total, 1);
  assert.deepEqual(stats.categories[0].days, [2, 0, 0, 0, 0, 0, 1]);
});
test("zero tasks have no invented completion rate", () => {
  assert.equal(taskCounts([]).rate, null);
  assert.equal(analyzeTasks([]).total, 0);
  assert.match(weeklySummary(analyzeTasks([]), {}), /henüz görev yok/);
});
test("Turkish title grouping normalizes case and whitespace without merging different titles", () => {
  assert.equal(titleKey("  FİZİK   Tekrar  "), "fizik tekrar");
  const stats = analyzeTasks([task("1", "2026-10-01", false, { title: "FİZİK Tekrar", category_id: "physics" }), task("2", "2026-10-02", true, { title: "fizik  tekrar", category_id: "physics" }), task("3", "2026-10-02", false, { title: "Fizik konu" })]);
  assert.equal(stats.titles.length, 2);
  assert.equal(stats.titles[0].total, 2);
  assert.equal(stats.titles[0].completed, 1);
});
test("general weekday counts aggregate multiple weeks and summary keeps ties", () => {
  const stats = analyzeTasks([task("1", "2026-09-28"), task("2", "2026-10-05"), task("3", "2026-09-29", false, { category_id: "physics" }), task("4", "2026-10-06", false, { category_id: "physics" })]);
  assert.equal(stats.daily[0].total, 2);
  assert.equal(stats.daily[1].total, 2);
  assert.match(weeklySummary(stats, { math: "Matematik", physics: "Fizik" }), /Pazartesi, Salı/);
  assert.match(weeklySummary(stats, { math: "Matematik", physics: "Fizik" }), /Matematik, Fizik/);
});
test("date query validation rejects impossible days and arrays", () => {
  assert.equal(validAnalysisDate("2026-02-30"), false);
  assert.equal(validAnalysisDate(["2026-10-01"]), false);
  assert.equal(validAnalysisDate("2028-02-29"), true);
});
