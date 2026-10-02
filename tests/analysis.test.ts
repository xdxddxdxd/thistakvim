import assert from "node:assert/strict";
import { test } from "node:test";
import { analyzeStudyTime, analyzeTasks, compareClosedDays, studyTimeTotals, taskCounts, titleKey, validAnalysisDate, weeklySummary, type AnalysisData, type AnalysisTask } from "../lib/analysis";
const task = (_id: string, date: string, completed = false, extra: Partial<AnalysisTask> = {}): AnalysisTask => ({ date, completed, category_id: "math", title: "Problemler", ...extra });

test("week stats exclude other weeks and deleted tasks", () => {
  const stats = analyzeTasks([
    task("1", "2026-09-28", true), task("2", "2026-09-28"), task("3", "2026-10-04"),
    task("4", "2026-09-27"), task("5", "2026-10-05"), task("6", "2026-10-01", false, { deleted_at: "2026-10-01" }),
  ], "2026-09-28");
  assert.deepEqual([stats.total, stats.completed, stats.rate], [3, 1, 33]);
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

test("weekly study time sums daily records independently of tasks and excludes other weeks", () => {
  const stats = analyzeStudyTime([
    { date: "2026-09-27", minutes: 120 },
    { date: "2026-09-28", minutes: 155 },
    { date: "2026-09-30", minutes: 65 },
    { date: "2026-10-04", minutes: 20 },
    { date: "2026-10-05", minutes: 180 },
  ], "2026-10-06", "2026-09-28");
  assert.equal(stats.totalMinutes, 240);
  assert.equal(stats.recordedDays, 3);
  assert.equal(stats.daily[0].date, "2026-09-28");
  assert.equal(stats.daily[0].totalMinutes, 155);
  assert.equal(stats.daily[2].totalMinutes, 65);
  assert.equal(stats.daily[6].totalMinutes, 20);
});

test("unrecorded study time remains distinct from a valid zero-minute day", () => {
  assert.deepEqual(studyTimeTotals([]), { totalMinutes: null, recordedDays: 0, averageMinutes: null });
  assert.deepEqual(studyTimeTotals([{ date: "2026-10-01", minutes: 0 }]), { totalMinutes: 0, recordedDays: 1, averageMinutes: 0 });
  const stats = analyzeStudyTime([{ date: "2026-09-28", minutes: 0 }], "2026-10-01", "2026-09-28");
  assert.equal(stats.totalMinutes, 0);
  assert.equal(stats.daily[0].totalMinutes, 0);
  assert.equal(stats.daily[0].recordedDays, 1);
  assert.equal(stats.daily[1].totalMinutes, null);
  assert.equal(stats.daily[1].isFuture, false);
});

test("study time ignores future records and identifies days that have not arrived", () => {
  const stats = analyzeStudyTime([
    { date: "2026-10-01", minutes: 40 },
    { date: "2026-10-02", minutes: 90 },
  ], "2026-10-01", "2026-09-28");
  assert.equal(stats.totalMinutes, 40);
  assert.equal(stats.recordedDays, 1);
  assert.equal(stats.daily[3].isFuture, false);
  assert.equal(stats.daily[4].isFuture, true);
  assert.equal(stats.daily[4].totalMinutes, null);
  const futureWeek = analyzeStudyTime([], "2026-10-01", "2026-10-05");
  assert.equal(futureWeek.totalMinutes, null);
  assert.ok(futureWeek.daily.every((day) => day.isFuture));
});

test("general study time aggregates all matching weekdays without assigning a single week date", () => {
  const stats = analyzeStudyTime([
    { date: "2026-09-28", minutes: 60 },
    { date: "2026-10-05", minutes: 95 },
    { date: "2026-10-06", minutes: 0 },
    { date: "2026-10-07", minutes: 500 },
  ], "2026-10-06");
  assert.equal(stats.totalMinutes, 155);
  assert.equal(stats.recordedDays, 3);
  assert.equal(stats.daily[0].totalMinutes, 155);
  assert.equal(stats.daily[0].recordedDays, 2);
  assert.equal(stats.daily[0].averageMinutes, 78);
  assert.equal(stats.daily[1].averageMinutes, 0);
  assert.equal(stats.daily[2].averageMinutes, null);
  assert.equal(stats.daily[1].totalMinutes, 0);
  assert.equal(stats.daily[2].totalMinutes, null);
  assert.ok(stats.daily.every((day) => day.date === undefined && !day.isFuture));
});

test("grouped database counts retain task, course, title and weekday totals", () => {
  const stats = analyzeTasks([task("1", "2026-09-28", true, { count: 3 }), task("2", "2026-09-28", false, { count: 2 })]);
  assert.equal(stats.total, 5);
  assert.equal(stats.completed, 3);
  assert.equal(stats.rate, 60);
  assert.equal(stats.daily[0].total, 5);
  assert.equal(stats.categories[0].days[0], 5);
  assert.equal(stats.titles[0].total, 5);
});

test("fair comparison excludes today and pairs only recorded matching weekdays including zero", () => {
  const data: AnalysisData = {
    asOf: "2026-10-02", closedThrough: "2026-10-01", chartStudyTimes: [], chartMonth: "2026-10-01", chartMonthEnd: "2026-10-31",
    tasks: [task("1", "2026-09-28", true), task("2", "2026-10-02", true), task("3", "2026-10-04")],
    previous: [task("4", "2026-09-21", true), task("5", "2026-09-25", true)],
    studyTimes: [{ date: "2026-09-28", minutes: 0 }, { date: "2026-09-29", minutes: 120 }, { date: "2026-10-02", minutes: 600 }],
    previousStudyTimes: [{ date: "2026-09-21", minutes: 90 }, { date: "2026-09-23", minutes: 120 }, { date: "2026-09-25", minutes: 600 }],
  };
  const result = compareClosedDays(data, "2026-09-28");
  assert.equal(result.days, 4);
  assert.equal(result.current.total, 1);
  assert.equal(result.previous.total, 1);
  assert.equal(result.pairedStudyDays, 1);
  assert.equal(result.current.totalMinutes, 0);
  assert.equal(result.previous.totalMinutes, 90);
  const future = compareClosedDays(data, "2026-10-05");
  assert.equal(future.days, 0);
  assert.equal(future.current.total, 0);
  assert.equal(future.current.totalMinutes, null);
  const past = compareClosedDays({ ...data, closedThrough: "2026-10-04" }, "2026-09-28");
  assert.equal(past.days, 7);
  assert.equal(past.current.total, 3);
  assert.equal(past.pairedStudyDays, 2);
});

test("comparison cannot invent a zero-minute baseline from missing records", () => {
  const result = compareClosedDays({ tasks: [], previous: [], studyTimes: [{ date: "2026-09-28", minutes: 120 }], previousStudyTimes: [], asOf: "2026-10-02", closedThrough: "2026-10-01", chartStudyTimes: [], chartMonth: "2026-10-01", chartMonthEnd: "2026-10-31" }, "2026-09-28");
  assert.equal(result.pairedStudyDays, 0);
  assert.equal(result.current.totalMinutes, null);
  assert.equal(result.previous.totalMinutes, null);
});

test("weekly study totals compare recorded sums without treating missing weeks as zero", () => {
  const before = analyzeStudyTime([{ date: "2026-09-21", minutes: 80 }], "2026-10-04", "2026-09-21");
  const current = analyzeStudyTime([{ date: "2026-09-28", minutes: 125 }], "2026-10-04", "2026-09-28");
  assert.equal(current.totalMinutes! - before.totalMinutes!, 45);
  assert.equal(analyzeStudyTime([], "2026-10-04", "2026-09-21").totalMinutes, null);
  assert.equal(studyTimeTotals(Array.from({ length: 7 }, (_, index) => ({ date: `2026-10-0${index + 1}`, minutes: 1440 }))).totalMinutes, 10080);
});
