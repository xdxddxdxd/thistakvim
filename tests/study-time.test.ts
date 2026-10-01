import assert from "node:assert/strict";
import { test } from "node:test";
import { canRecordStudyTime, studyMinutes, studyTimeLabel } from "../lib/study-time";
test("study time is a daily total expressed in whole hours and minutes", () => {
  assert.equal(studyMinutes(2, 35), 155);
  assert.equal(studyTimeLabel(155), "2 saat 35 dakika");
  assert.equal(studyMinutes(0, 0), 0);
  assert.equal(studyMinutes(24, 0), 1440);
});
test("invalid values and totals above one day are rejected", () => {
  for (const [hours, minutes] of [[24, 1], [1, 60], [-1, 0], [0, -1], [2.5, 0], [0, 1.2], [NaN, 0], [Infinity, 0], ["2", 5], [null, 0]]) assert.equal(studyMinutes(hours, minutes), null);
});
test("study time can change throughout the same day and locks at 23:59", () => {
  const now = new Date("2026-10-01T09:00:00Z");
  assert.equal(canRecordStudyTime("2026-10-02", false, now), false);
  assert.equal(canRecordStudyTime("2026-10-02", true, now), false);
  assert.equal(canRecordStudyTime("2026-10-01", false, now), true);
  assert.equal(canRecordStudyTime("2026-10-01", true, now), true);
  assert.equal(canRecordStudyTime("2026-09-30", false, now), false);
  assert.equal(canRecordStudyTime("2026-10-01", false, new Date("2026-10-01T20:58:59Z")), true);
  assert.equal(canRecordStudyTime("2026-10-01", false, new Date("2026-10-01T20:59:00Z")), false);
});
