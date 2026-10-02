import assert from "node:assert/strict";
import { test } from "node:test";
import {
  decodePDFRawStream,
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFName,
  PDFRawStream,
  StandardFonts,
} from "pdf-lib";
import { createWeekPdf, WeekPdfDensityError, wrapPdfText } from "../lib/week-pdf";
import { addDays } from "../lib/dates";
import type { Category, Task, WeekData } from "../lib/types";

const start = "2026-09-28";
const category: Category = {
  id: "category",
  user_id: "user",
  name: "Türkçe",
  accent_color: "#258a84",
  position: 0,
};
const task = (index: number, date = start): Task => ({
  id: `task-${index}`,
  date,
  user_id: "user",
  category_id: category.id,
  title: `Görev ${index}: Çığ, ışık, öğüt ve şüphe`,
  description: "DESCRIPTION_MUST_NOT_APPEAR ".repeat(100),
  note: "TASK_NOTE_MUST_NOT_APPEAR",
  completed: index % 2 === 0,
  position: index * 1024,
  created_at: "2026-09-28T00:00:00Z",
  updated_at: "2026-09-28T00:00:00Z",
  deleted_at: null,
});
const data = (tasks: Task[]): WeekData => ({
  tasks,
  statuses: [],
  notes: [{
    id: "note",
    revision: 1,
    user_id: "user",
    date: start,
    content: "DAY_NOTE_MUST_NOT_APPEAR ".repeat(100),
    created_at: "",
    updated_at: "",
  }],
});

// Read text from the finished PDF, including its embedded Turkish font maps.
async function pdfText(bytes: Uint8Array) {
  const document = await PDFDocument.load(bytes);
  const page = document.getPages()[0];
  const fonts = page.node.Resources()!.lookup(PDFName.of("Font"), PDFDict);
  const maps = new Map<string, Map<string, string>>();
  for (const key of fonts.keys()) {
    const font = fonts.lookup(key, PDFDict);
    const stream = font.lookup(PDFName.of("ToUnicode")) as PDFRawStream;
    const cmap = Buffer.from(decodePDFRawStream(stream).decode()).toString();
    const mappings = new Map<string, string>();
    for (const [, code, unicode] of cmap.matchAll(/<([\da-f]+)>\s*<([\da-f]+)>/gi)) {
      const characters = unicode.match(/.{4}/g)!.map((unit) => String.fromCharCode(parseInt(unit, 16)));
      mappings.set(code.toUpperCase(), characters.join(""));
    }
    maps.set(key.asString().slice(1), mappings);
  }
  const contents = page.node.Contents();
  const streams = contents instanceof PDFArray
    ? Array.from({ length: contents.size() }, (_, index) => contents.lookup(index, PDFRawStream))
    : [contents as PDFRawStream];
  const operators = streams.map((stream) => Buffer.from(decodePDFRawStream(stream).decode()).toString()).join("\n");
  const rows: { text: string; size: number; x: number; y: number }[] = [];
  let font = "", size = 0, x = 0, y = 0;
  for (const match of operators.matchAll(/\/([^\s/]+)\s+([\d.]+)\s+Tf|1\s+0\s+0\s+1\s+([-\d.]+)\s+([-\d.]+)\s+Tm|<([\da-f]+)>\s+Tj/gi)) {
    if (match[1]) {
      font = match[1];
      size = Number(match[2]);
    } else if (match[3]) {
      x = Number(match[3]);
      y = Number(match[4]);
    } else {
      const text = match[5].match(/.{4}/g)!.map((code) => maps.get(font)!.get(code.toUpperCase()) ?? "").join("");
      rows.push({ text, size, x, y });
    }
  }
  return { document, rows, text: rows.map((row) => row.text).join(" "), operators };
}

test("PDF wraps oversized words without exceeding the printable width", async () => {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const input = "A".repeat(200) + "\nSecond paragraph";
  const lines = wrapPdfText(input, font, 10, 120);
  assert.ok(lines.length > 5);
  assert.ok(lines.every((line) => font.widthOfTextAtSize(line, 10) <= 120));
  assert.equal(lines.join("").replaceAll(" ", ""), input.replaceAll("\n", "").replaceAll(" ", ""));
});

test("weekly PDF keeps all titles and courses on one landscape page with seven days", async () => {
  const tasks = Array.from({ length: 30 }, (_, index) => task(index, addDays(start, index % 7)));
  const fixture = data([
    ...tasks,
    { ...task(99, addDays(start, -1)), title: "OUTSIDE_PREVIOUS_WEEK" },
    { ...task(100, addDays(start, 7)), title: "OUTSIDE_NEXT_WEEK" },
    { ...task(101), title: "DELETED_TASK", deleted_at: "2026-09-28T00:00:00Z" },
  ]);
  const result = await pdfText(await createWeekPdf(start, fixture, [category], "paper"));
  assert.equal(result.document.getPageCount(), 1);
  assert.equal(result.document.getPages()[0].getWidth(), 841.89);
  assert.equal(result.document.getPages()[0].getHeight(), 595.28);
  assert.match(result.document.getTitle()!, /28 Eyl.*4 Eki 2026/);
  for (const task of tasks) assert.ok(result.text.includes(task.title), `Missing title: ${task.title}`);
  assert.equal(result.rows.filter((row) => row.text === category.name).length, tasks.length);
  const weekdays = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"];
  assert.equal(new Set(result.rows.filter((row) => weekdays.includes(row.text)).map((row) => row.x)).size, 7);
  for (const forbidden of ["DESCRIPTION_MUST_NOT_APPEAR", "TASK_NOTE_MUST_NOT_APPEAR", "DAY_NOTE_MUST_NOT_APPEAR", "OUTSIDE_PREVIOUS_WEEK", "OUTSIDE_NEXT_WEEK", "DELETED_TASK", "tamamlandı"])
    assert.ok(!result.text.includes(forbidden), `Unexpected content: ${forbidden}`);
  assert.ok(result.rows.every((row) => row.x >= 28 && row.x < 814 && row.y >= 42 && row.y < 595.28));
});

test("dense readable weeks shrink every task to the same size and retain titles", async () => {
  const tasks = Array.from({ length: 13 }, (_, index) => ({ ...task(index), title: `Görev ${index}` }));
  tasks.push({ ...task(20, addDays(start, 1)), title: "Ertesi gün" });
  const result = await pdfText(await createWeekPdf(start, data(tasks), [category], "paper"));
  const titles = result.rows.filter((row) => tasks.some((task) => task.title === row.text));
  assert.equal(titles.length, tasks.length);
  assert.equal(new Set(titles.map((row) => row.size)).size, 1);
  assert.ok(titles[0].size >= 7 && titles[0].size < 9.5);
  assert.ok(result.rows.every((row) => row.size >= 6.5 && row.y >= 42));
  assert.equal(result.document.getPageCount(), 1);
});

test("unreadably dense weeks fail clearly instead of dropping tasks or adding pages", async () => {
  const tasks = Array.from({ length: 100 }, (_, index) => task(index));
  await assert.rejects(createWeekPdf(start, data(tasks), [category], "paper"), (error: unknown) =>
    error instanceof WeekPdfDensityError && /tek sayfaya sığmıyor/.test(error.message));
});

test("dark screen theme still exports the same light PDF and ignores completion flags", async () => {
  const tasks = [task(0), task(1, addDays(start, 1))];
  const light = await pdfText(await createWeekPdf(start, data(tasks), [category], "paper"));
  const dark = await pdfText(await createWeekPdf(start, data(tasks.map((task) => ({ ...task, completed: !task.completed }))), [category], "dark"));
  assert.equal(light.operators, dark.operators);
});

test("an empty year-spanning week stays on one landscape page", async () => {
  const result = await pdfText(await createWeekPdf("2025-12-29", { tasks: [], notes: [], statuses: [] }, [], "monochrome"));
  assert.equal(result.document.getPageCount(), 1);
  assert.equal(result.document.getPages()[0].getWidth(), 841.89);
  assert.equal(result.document.getPages()[0].getHeight(), 595.28);
  assert.match(result.document.getTitle()!, /2025.*2026/);
  assert.equal(result.rows.filter((row) => row.text === "Görev yok").length, 7);
});
