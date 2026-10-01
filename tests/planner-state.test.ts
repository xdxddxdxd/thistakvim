import assert from "node:assert/strict";
import { test } from "node:test";
import { applyTaskSnapshot } from "../lib/planner-state";
import type { Task, WeekData } from "../lib/types";
const task = (id: string, date: string, position = 1024): Task => ({ id, date, position, user_id: "u", category_id: "c", title: id, description: "", note: "", completed: false, created_at: "", updated_at: "", deleted_at: null });
test("authoritative day snapshots remove deleted/moved rows and retain unaffected days and notes", () => {
  const old: WeekData = { tasks: [task("moved", "2026-10-02"), task("deleted", "2026-10-02"), task("other", "2026-10-01")], notes: [], statuses: [] };
  const result = applyTaskSnapshot(old, ["2026-10-02", "2026-10-03"], [task("moved", "2026-10-03", 2048), task("renumbered", "2026-10-03", 1024)], "2026-09-28");
  assert.deepEqual(result.tasks.map((t) => [t.id, t.date]), [["other", "2026-10-01"], ["renumbered", "2026-10-03"], ["moved", "2026-10-03"]]);
  assert.equal(result.notes, old.notes);
  assert.equal(old.tasks.length, 3);
});
test("a late response from the previous week cannot add old tasks to a newly selected week", () => {
  const current: WeekData = { tasks: [task("current", "2026-10-05")], notes: [], statuses: [] };
  const result = applyTaskSnapshot(current, ["2026-10-02"], [task("old", "2026-10-02")], "2026-10-05");
  assert.deepEqual(result.tasks, current.tasks);
});
