import test from "node:test";
import assert from "node:assert/strict";
import { analysisLocation, analysisUrl } from "../lib/analysis-location";
import { readNoteDraft, storeNoteDraft } from "../lib/note-drafts";

test("analysis link preserves scope and course section", () => {
  const state = { scope: "all" as const, section: "courses" as const };
  const url = new URL(analysisUrl("2026-09-28", state), "http://localhost");
  assert.deepEqual(analysisLocation(Object.fromEntries(url.searchParams)), state);
});
test("invalid analysis links fall back safely", () => {
  assert.deepEqual(analysisLocation({ scope: "wrong", section: "unknown", filter: "{" }), { scope: "week", section: "summary" });
  assert.deepEqual(analysisLocation({ section: "tasks", filter: "obsolete" }), { scope: "week", section: "summary" });
});
test("drafts retain empty edits and revision and are isolated by account and date", () => {
  const values = new Map<string, string>();
  const storage = { getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => { values.set(k, v); }, removeItem: (k: string) => { values.delete(k); } };
  assert.equal(storeNoteDraft(storage, "one", "2026-10-01", { content: "", revision: 3 }), true);
  assert.deepEqual(readNoteDraft(storage, "one", "2026-10-01"), { content: "", revision: 3 });
  assert.equal(readNoteDraft(storage, "two", "2026-10-01"), null);
  assert.equal(readNoteDraft(storage, "one", "2026-10-02"), null);
  storeNoteDraft(storage, "one", "2026-10-01", null);
  assert.equal(readNoteDraft(storage, "one", "2026-10-01"), null);
});
test("storage failures are reported so navigation cannot silently lose a draft", () => {
  const storage = { getItem: () => "bad json", setItem: () => { throw new Error("quota"); }, removeItem: () => { throw new Error("disabled"); } };
  assert.equal(readNoteDraft(storage, "one", "2026-10-01"), null);
  assert.equal(storeNoteDraft(storage, "one", "2026-10-01", { content: "taslak", revision: 0 }), false);
});
