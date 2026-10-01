import { readFile } from "node:fs/promises";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { addDays, dateLabel, weekDates, weekLabel } from "./dates";
import type { Category, Task, Theme, WeekData } from "./types";

let fontBytes: Promise<Buffer[]> | undefined;
const ink = rgb(0.09, 0.09, 0.08),
  muted = rgb(0.38, 0.38, 0.36),
  rule = rgb(0.83, 0.83, 0.8);

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
  const W = 595.28,
    H = 841.89,
    margin = 36,
    contentWidth = W - margin * 2;
  let page!: PDFPage;
  let y = 0;
  const draw = (
    text: string,
    x: number,
    top: number,
    size = 10,
    font = regular,
    color = ink,
  ) => {
    page.drawText(text.replace(/[\x00-\x08\x0b-\x1f]/g, ""), {
      x,
      y: H - top - size,
      size,
      font,
      color,
    });
  };
  const newPage = (first = false) => {
    page = document.addPage([W, H]);
    draw("Haftalık Plan", margin, 32, 24, bold);
    draw(printableWeek, margin, 65, 11, regular, muted);
    const count = `${tasks.filter((task) => task.completed).length} / ${tasks.length} tamamlandı`;
    draw(count, W - margin - regular.widthOfTextAtSize(count, 10), 68, 10);
    page.drawLine({
      start: { x: margin, y: H - 91 },
      end: { x: W - margin, y: H - 91 },
      color: ink,
      thickness: 1.5,
    });
    y = 108;
    if (first) {
      const gap = 5,
        width = (contentWidth - gap * 6) / 7;
      for (const [index, date] of weekDates(start).entries()) {
        const x = margin + index * (width + gap);
        page.drawRectangle({
          x,
          y: H - 182,
          width,
          height: 74,
          borderWidth: 0.7,
          borderColor: rule,
          color: theme === "paper" ? rgb(0.98, 0.97, 0.94) : rgb(1, 1, 1),
        });
        draw(dateLabel(date, { weekday: "short" }), x + 8, 116, 9, bold);
        draw(dateLabel(date, { day: "numeric" }), x + 8, 132, 19, bold);
        draw(
          `${tasks.filter((task) => task.date === date).length} görev`,
          x + 8,
          162,
          8,
          regular,
          muted,
        );
      }
      y = 200;
    }
  };
  newPage(true);
  let activeDate = "";
  function dayHeading(continued = false) {
    draw(
      `${dateLabel(activeDate, { day: "numeric", month: "long", weekday: "long" })}${continued ? " (devam)" : ""}`,
      margin,
      y,
      13,
      bold,
    );
    y += 27;
  }
  function room(height: number) {
    if (y + height > H - 58) {
      newPage();
      dayHeading(true);
    }
  }
  function paragraph(
    text: string,
    x: number,
    size: number,
    color = muted,
    font = regular,
  ) {
    for (const line of wrapPdfText(text, font, size, W - margin - x)) {
      room(size + 5);
      draw(line, x, y, size, font, color);
      y += size + 5;
    }
  }
  function taskHeight(task: Task) {
    const width = contentWidth - 24;
    return (
      wrapPdfText(task.title, bold, 10.5, width).length * 15.5 +
      (categories.some((category) => category.id === task.category_id)
        ? 16
        : 0) +
      (task.description
        ? wrapPdfText(task.description, regular, 9.5, width).length * 14.5
        : 0) +
      (task.note
        ? wrapPdfText(`Not: ${task.note}`, regular, 9, width).length * 14
        : 0) +
      10
    );
  }
  for (const date of weekDates(start)) {
    activeDate = date;
    const dayTasks = tasks
      .filter((task) => task.date === date)
      .sort((a, b) => a.position - b.position || a.id.localeCompare(b.id));
    const firstHeight = dayTasks.length ? taskHeight(dayTasks[0]) : 24;
    if (y + 27 + (firstHeight <= H - 193 ? firstHeight : 60) > H - 58)
      newPage();
    dayHeading();
    for (const task of dayTasks) {
      const category = categories.find(
        (category) => category.id === task.category_id,
      );
      const title = wrapPdfText(task.title, bold, 10.5, contentWidth - 27);
      const height = taskHeight(task);
      room(height <= H - 193 ? height : Math.min(title.length * 15 + 29, 85));
      const boxY = H - y - 11;
      page.drawRectangle({
        x: margin,
        y: boxY,
        width: 10,
        height: 10,
        borderColor: ink,
        borderWidth: 0.9,
      });
      if (task.completed) {
        page.drawLine({
          start: { x: margin + 2, y: boxY + 5 },
          end: { x: margin + 4, y: boxY + 2 },
          thickness: 1.3,
          color: ink,
        });
        page.drawLine({
          start: { x: margin + 4, y: boxY + 2 },
          end: { x: margin + 8, y: boxY + 8 },
          thickness: 1.3,
          color: ink,
        });
      }
      paragraph(task.title, margin + 24, 10.5, ink, bold);
      if (category) {
        const hex = category.accent_color.slice(1);
        const color =
          theme === "monochrome"
            ? ink
            : rgb(
                parseInt(hex.slice(0, 2), 16) / 255,
                parseInt(hex.slice(2, 4), 16) / 255,
                parseInt(hex.slice(4, 6), 16) / 255,
              );
        room(15);
        page.drawCircle({ x: margin + 27, y: H - y - 5, size: 2.5, color });
        draw(category.name, margin + 35, y, 8.5, regular, muted);
        y += 16;
      }
      if (task.description) paragraph(task.description, margin + 24, 9.5);
      if (task.note) paragraph(`Not: ${task.note}`, margin + 24, 9);
      y += 10;
    }
    if (!dayTasks.length) {
      draw("Görev yok", margin, y, 10, regular, muted);
      y += 24;
    }
    const note = data.notes.find((note) => note.date === date)?.content;
    if (note) {
      room(40);
      draw("Günün notu", margin + 24, y, 9, bold);
      y += 17;
      paragraph(note, margin + 24, 9.5);
      y += 10;
    }
    if (y + 6 <= H - 58)
      page.drawLine({
        start: { x: margin, y: H - y },
        end: { x: W - margin, y: H - y },
        color: rule,
        thickness: 0.6,
      });
    y += 20;
  }
  const pages = document.getPages();
  pages.forEach((pdfPage, index) => {
    const label = `${index + 1} / ${pages.length}`;
    pdfPage.drawText(label, {
      x: W - margin - regular.widthOfTextAtSize(label, 8),
      y: 25,
      size: 8,
      font: regular,
      color: muted,
    });
    pdfPage.drawText(printableWeek, {
      x: margin,
      y: 25,
      size: 8,
      font: regular,
      color: muted,
    });
  });
  return document.save();
}
