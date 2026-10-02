import { readFile } from "node:fs/promises";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb, type PDFFont } from "pdf-lib";
import { addDays, dateLabel, weekDates, weekLabel } from "./dates";
import type { Category, Theme, WeekData } from "./types";

let fontBytes: Promise<Buffer[]> | undefined;
const ink = rgb(0.09, 0.09, 0.08),
  muted = rgb(0.38, 0.38, 0.36),
  rule = rgb(0.83, 0.83, 0.8);

export class WeekPdfDensityError extends Error {
  constructor() {
    super(
      "Bu hafta, görev başlıkları ve ders adları okunaklı biçimde tek sayfaya sığmıyor. Daha kısa başlıklar kullan veya görevleri diğer günlere dağıt.",
    );
    this.name = "WeekPdfDensityError";
  }
}

// Also split oversized words, preserving line breaks and Turkish glyphs.
export function wrapPdfText(
  value: string,
  font: PDFFont,
  size: number,
  width: number,
): string[] {
  const lines: string[] = [];
  for (const paragraph of value.replace(/\r/g, "").split("\n")) {
    let line = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      if (line && font.widthOfTextAtSize(`${line} ${word}`, size) <= width) {
        line += ` ${word}`;
        continue;
      }
      if (line) lines.push(line);
      line = "";
      for (const char of Array.from(word)) {
        if (line && font.widthOfTextAtSize(line + char, size) > width) {
          lines.push(line);
          line = "";
        }
        line += char;
      }
    }
    lines.push(line);
  }
  return lines;
}

function printableText(value: string) {
  return value.replace(/[\x00-\x08\x0b-\x1f]/g, "");
}

export async function createWeekPdf(
  start: string,
  data: WeekData,
  categories: Category[],
  theme: Theme,
) {
  const tasks = data.tasks.filter(
    (task) =>
      !task.deleted_at && task.date >= start && task.date <= addDays(start, 6),
  );
  const document = await PDFDocument.create();
  document.registerFontkit(fontkit);
  fontBytes ??= Promise.all(
    ["Regular", "Bold"].map((weight) =>
      readFile(path.join(process.cwd(), `public/fonts/DMSans-${weight}.ttf`)),
    ),
  );
  const [regularBytes, boldBytes] = await fontBytes;
  const regular = await document.embedFont(regularBytes, { subset: true });
  const bold = await document.embedFont(boldBytes, { subset: true });
  const printableWeek = weekLabel(start).replaceAll("–", "-");
  document.setTitle(`Haftalık Plan - ${printableWeek}`);
  document.setAuthor("Haftalık Plan");
  document.setLanguage("tr-TR");

  const W = 841.89,
    H = 595.28,
    margin = 28,
    columnGap = 6,
    columnWidth = (W - margin * 2 - columnGap * 6) / 7,
    columnPadding = 8,
    textWidth = columnWidth - columnPadding * 2,
    gridTop = 94,
    gridBottom = H - 42,
    bodyTop = gridTop + 63,
    bodyHeight = gridBottom - bodyTop - 10;
  const categoryMap = new Map(categories.map((category) => [category.id, category]));
  const days = weekDates(start).map((date) => ({
    date,
    tasks: tasks
      .filter((task) => task.date === date)
      .sort((a, b) => a.position - b.position || a.id.localeCompare(b.id)),
  }));

  function layoutAt(size: number) {
    const categorySize = Math.max(6.5, size - 1),
      titleLeading = size * 1.3,
      categoryLeading = categorySize * 1.3,
      categoryGap = 3,
      taskGap = size + 2;
    const columns = days.map((day) => {
      const rows = day.tasks.map((task) => {
        const category = categoryMap.get(task.category_id);
        const title = wrapPdfText(printableText(task.title), bold, size, textWidth);
        const course = category
          ? wrapPdfText(printableText(category.name), regular, categorySize, textWidth - 7)
          : [];
        return {
          title,
          course,
          category,
          height:
            title.length * titleLeading +
            (course.length ? categoryGap + course.length * categoryLeading : 0),
        };
      });
      return {
        ...day,
        rows,
        height: rows.reduce((sum, row) => sum + row.height, 0) + Math.max(0, rows.length - 1) * taskGap,
      };
    });
    return { size, categorySize, titleLeading, categoryLeading, categoryGap, taskGap, columns };
  }

  // Use one size for the whole week, determined by the busiest column.
  let layout = layoutAt(9.5);
  while (layout.columns.some((column) => column.height > bodyHeight) && layout.size > 7) {
    layout = layoutAt(layout.size - 0.25);
  }
  if (layout.columns.some((column) => column.height > bodyHeight)) {
    throw new WeekPdfDensityError();
  }

  const page = document.addPage([W, H]);
  const draw = (
    text: string,
    x: number,
    top: number,
    size = 10,
    font = regular,
    color = ink,
  ) => {
    page.drawText(printableText(text), { x, y: H - top - size, size, font, color });
  };
  draw("Haftalık Plan", margin, 24, 24, bold);
  draw(printableWeek, margin, 59, 10.5, regular, muted);
  page.drawLine({
    start: { x: margin, y: H - 79 },
    end: { x: W - margin, y: H - 79 },
    color: ink,
    thickness: 1.3,
  });

  for (const [index, column] of layout.columns.entries()) {
    const x = margin + index * (columnWidth + columnGap),
      textX = x + columnPadding;
    page.drawRectangle({
      x,
      y: H - gridBottom,
      width: columnWidth,
      height: gridBottom - gridTop,
      borderWidth: 0.6,
      borderColor: rule,
    });
    page.drawRectangle({
      x: x + 0.3,
      y: H - gridTop - 51,
      width: columnWidth - 0.6,
      height: 50.7,
      color: theme === "monochrome" ? rgb(0.96, 0.96, 0.96) : rgb(0.98, 0.97, 0.94),
    });
    draw(dateLabel(column.date, { weekday: "long" }), textX, gridTop + 9, 10, bold);
    draw(dateLabel(column.date, { day: "numeric", month: "short" }), textX, gridTop + 28, 9, regular, muted);
    page.drawLine({
      start: { x, y: H - gridTop - 51 },
      end: { x: x + columnWidth, y: H - gridTop - 51 },
      color: rule,
      thickness: 0.6,
    });

    let top = bodyTop;
    for (const [rowIndex, row] of column.rows.entries()) {
      if (rowIndex) {
        page.drawLine({
          start: { x: textX, y: H - top - layout.taskGap / 2 },
          end: { x: x + columnWidth - columnPadding, y: H - top - layout.taskGap / 2 },
          color: rule,
          thickness: 0.35,
        });
        top += layout.taskGap;
      }
      for (const line of row.title) {
        draw(line, textX, top, layout.size, bold);
        top += layout.titleLeading;
      }
      if (row.course.length) {
        top += layout.categoryGap;
        const hex = row.category!.accent_color.slice(1);
        const accent = theme === "monochrome" || !/^[\da-f]{6}$/i.test(hex)
          ? ink
          : rgb(
              parseInt(hex.slice(0, 2), 16) / 255,
              parseInt(hex.slice(2, 4), 16) / 255,
              parseInt(hex.slice(4, 6), 16) / 255,
            );
        page.drawCircle({
          x: textX + 1.8,
          y: H - top - layout.categorySize / 2 - 0.5,
          size: 1.6,
          color: accent,
        });
        for (const line of row.course) {
          draw(line, textX + 7, top, layout.categorySize, regular, muted);
          top += layout.categoryLeading;
        }
      }
    }
    if (!column.rows.length) draw("Görev yok", textX, bodyTop, 8.5, regular, muted);
  }
  return document.save();
}
