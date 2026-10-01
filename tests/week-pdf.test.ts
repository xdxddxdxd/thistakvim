import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdir, writeFile } from "node:fs/promises";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { createWeekPdf, wrapPdfText } from "../lib/week-pdf";
import { addDays } from "../lib/dates";
import type { Category, Task, WeekData } from "../lib/types";

test("PDF wraps oversized words without exceeding the printable width", async () => {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const input = "A".repeat(200) + "\nSecond paragraph";
  const lines = wrapPdfText(input, font, 10, 120);
  assert.ok(lines.length > 5);
  assert.ok(lines.every((line) => font.widthOfTextAtSize(line, 10) <= 120));
  assert.equal(
    lines.join("").replaceAll(" ", ""),
    input.replaceAll("\n", "").replaceAll(" ", ""),
  );
});

test("weekly PDF embeds Turkish fonts and paginates long tasks and notes", async () => {
  const start = "2026-09-28";
  const category: Category = {
    id: "category",
    user_id: "user",
    name: "Türkçe",
    accent_color: "#258a84",
    position: 0,
  };
  const task = (index: number, date: string): Task => ({
    id: `task-${index}`,
    date,
    user_id: "user",
    category_id: category.id,
    title: `Görev ${index}: Çığ, ışık, öğüt ve şüphe`,
    description: "UzunParagraf".repeat(35),
    note: `Hatırlatıcı ${index}: Önemli soruları işaretle.`,
    completed: index % 2 === 0,
    position: index * 1024,
    created_at: "2026-09-28T00:00:00Z",
    updated_at: "2026-09-28T00:00:00Z",
    deleted_at: null,
  });
  const data: WeekData = {
    tasks: Array.from({ length: 30 }, (_, index) =>
      task(index, addDays(start, index % 7)),
    ),
    statuses: [],
    notes: [
      {
        id: "note",
        revision: 1,
        user_id: "user",
        date: start,
        content:
          "Günün notu: Çözümlerini gözden geçir.\n" + "Satır ".repeat(60),
        created_at: "",
        updated_at: "",
      },
    ],
  };
  data.tasks.push(
    { ...task(99, addDays(start, -1)), title: "OUTSIDE_PREVIOUS_WEEK" },
    { ...task(100, addDays(start, 7)), title: "OUTSIDE_NEXT_WEEK" },
    {
      ...task(101, start),
      title: "DELETED_TASK",
      deleted_at: "2026-09-28T00:00:00Z",
    },
  );
  const bytes = await createWeekPdf(start, data, [category], "paper");
  const result = await PDFDocument.load(bytes);
  assert.ok(result.getPageCount() > 1);
  assert.match(result.getTitle()!, /28 Eyl.*4 Eki 2026/);
  for (const page of result.getPages()) {
    assert.equal(page.getWidth(), 595.28);
    assert.equal(page.getHeight(), 841.89);
  }
  await mkdir(".impeccable/review", { recursive: true });
  await writeFile(".impeccable/review/weekly-pdf-long.pdf", bytes);
  const empty = await createWeekPdf(
    "2025-12-29",
    { tasks: [], notes: [], statuses: [] },
    [],
    "monochrome",
  );
  const emptyDocument = await PDFDocument.load(empty);
  assert.equal(emptyDocument.getPageCount(), 1);
  assert.match(emptyDocument.getTitle()!, /2025.*2026/);
});
