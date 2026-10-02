import assert from "node:assert/strict";
import { test } from "node:test";
import {
  addDays,
  isLocked,
  today,
  tytDaysRemaining,
  weekDates,
  weekLabel,
  weekStart,
} from "../lib/dates";
test("Monday starts and year/month boundaries use real dates", () => {
  assert.equal(weekStart("2026-01-04"), "2025-12-29");
  assert.equal(addDays("2025-12-31", 1), "2026-01-01");
  assert.equal(addDays("2028-02-28", 1), "2028-02-29");
  assert.deepEqual(weekDates("2025-12-29"), [
    "2025-12-29",
    "2025-12-30",
    "2025-12-31",
    "2026-01-01",
    "2026-01-02",
    "2026-01-03",
    "2026-01-04",
  ]);
  assert.match(weekLabel("2025-12-29"), /2025.*2026/);
});
test("TYT countdown uses Istanbul calendar days and stops at zero", () => {
  assert.equal(tytDaysRemaining("2027-06-18"), 1);
  assert.equal(tytDaysRemaining("2027-06-19"), 0);
  assert.equal(tytDaysRemaining("2027-06-20"), 0);
  assert.equal(tytDaysRemaining("2026-10-02"), 260);
  assert.equal(tytDaysRemaining(today(new Date("2027-06-17T21:00:00Z"))), 1);
  assert.equal(tytDaysRemaining(today(new Date("2027-06-18T21:00:00Z"))), 0);
});
test("Istanbul day lock occurs at 23:59 even before UTC midnight", () => {
  assert.equal(isLocked("2026-10-01", true, new Date("2026-10-01T20:58:59Z")), false);
  assert.equal(isLocked("2026-10-01", true, new Date("2026-10-01T20:59:00Z")), true);
  assert.equal(today(new Date("2026-10-01T21:30:00Z")), "2026-10-02");
  assert.equal(
    isLocked("2026-10-01", false, new Date("2026-10-01T20:58:59Z")),
    false,
  );
  assert.equal(
    isLocked("2026-10-01", false, new Date("2026-10-01T20:59:00Z")),
    true,
  );
  assert.equal(
    isLocked("2026-10-02", false, new Date("2026-10-01T20:59:00Z")),
    false,
  );
  assert.equal(
    isLocked("2026-10-02", true, new Date("2026-10-01T20:59:00Z")),
    true,
  );
});
