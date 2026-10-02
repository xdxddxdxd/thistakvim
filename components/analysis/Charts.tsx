"use client";

import { useId, useState, type CSSProperties } from "react";
import { addDays, dateLabel, dateObject, weekLabel } from "@/lib/dates";
import type { AnalysisStudyTime } from "@/lib/analysis";
import styles from "./Analysis.module.css";

export const duration = (minutes: number | null) => minutes === null ? "—" : `${Math.floor(minutes / 60)} sa ${minutes % 60} dk`;
export const percent = (rate: number | null) => rate === null ? "—" : `%${rate}`;

export function CompletionRing({ total, completed, rate }: { total: number; completed: number; rate: number | null }) {
  return <div className={styles.completion}>
    <div className={styles.ring} role="img" aria-label={total ? `${total} görevin ${completed} tanesi tamamlandı, ${percent(rate)}` : "Henüz görev yok"}>
      <svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="50" className={styles.ringTrack} /><circle cx="60" cy="60" r="50" pathLength="100" strokeDasharray="100" strokeDashoffset={100 - (rate ?? 0)} style={{ "--ring-offset": 100 - (rate ?? 0) } as CSSProperties} className={styles.ringProgress} /></svg>
      <div aria-hidden="true"><strong>{percent(rate)}</strong><span>tamamlanma</span></div>
    </div>
    <dl className={styles.taskTotals}><div><dt>Planlanan</dt><dd>{total}</dd></div><div><dt>Tamamlanan</dt><dd>{completed}</dd></div></dl>
  </div>;
}

export function CourseDonut({ courses }: { courses: { id: string; name: string; color: string; total: number }[] }) {
  const total = courses.reduce((sum, course) => sum + course.total, 0);
  let offset = 0;
  return <div className={styles.courseDonut}>
    <div className={styles.ring} role="img" aria-label={total ? courses.map((course) => `${course.name}: ${course.total} görev`).join(", ") : "Ders dağılımı için henüz görev yok"}>
      <svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="50" className={styles.ringTrack} />{courses.map((course) => {
        const length = total ? course.total / total * 100 : 0;
        const start = offset; offset += length;
        return <circle key={course.id} cx="60" cy="60" r="50" pathLength="100" fill="none" stroke={course.color} strokeWidth="12" strokeDasharray={`${length} ${100 - length}`} strokeDashoffset={-start} />;
      })}</svg><div aria-hidden="true"><strong>{courses.length}</strong><span>ders</span></div>
    </div>
    <ul>{courses.map((course) => <li key={course.id}><span className={styles.dot} style={{ background: course.color }} /><span>{course.name}</span><strong>%{Math.round(course.total / total * 100)}</strong></li>)}</ul>
  </div>;
}

export function TrendChart({ records, start, month, monthEnd, asOf }: { records: AnalysisStudyTime[]; start: string; month: string; monthEnd: string; asOf: string }) {
  const [interval, setInterval] = useState<"week" | "month">("week");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const detailId = useId();
  const firstDay = interval === "week" ? start : month;
  const dayCount = interval === "week" ? 7 : dateObject(monthEnd).getUTCDate();
  const minutesByDate = new Map(records.filter((record) => record.date <= asOf).map((record) => [record.date, record.minutes]));
  const days = Array.from({ length: dayCount }, (_, index) => {
    const date = addDays(firstDay, index);
    return { date, minutes: minutesByDate.get(date) ?? null, isFuture: date > asOf };
  });
  const selected = days.find((day) => day.date === selectedDate) ?? days.find((day) => day.date === asOf) ?? days.findLast((day) => day.minutes !== null) ?? days[0];
  const max = Math.max(60, ...days.map((day) => day.minutes ?? 0));
  const fullDate = (date: string) => dateLabel(date, { day: "numeric", month: "long", weekday: "long" });
  const dayValue = (day: typeof selected) => day.isFuture ? "Henüz gelmedi" : day.minutes === null ? "Kayıt yok" : duration(day.minutes);
  const hoursLabel = (amount: number) => `${(Math.round(amount / 60 * 10) / 10).toLocaleString("tr-TR")} sa`;
  return <section className={styles.panel} aria-labelledby="trend-heading">
    <div className={styles.sectionHeading}><h2 id="trend-heading">{interval === "week" ? "Haftalık gelişim" : "Aylık gelişim"}</h2><div className={styles.smallSwitch} aria-label="Grafik aralığı"><button aria-pressed={interval === "week"} onClick={() => setInterval("week")}>Haftalık</button><button aria-pressed={interval === "month"} onClick={() => setInterval("month")}>Aylık</button></div></div>
    <p className={styles.chartPeriod}>Çalışma süresi · {interval === "week" ? weekLabel(start) : dateLabel(month, { month: "long", year: "numeric" })}</p>
    <div className={styles.chartFrame}>
      <div className={styles.chartAxis} aria-hidden="true"><span>{hoursLabel(max)}</span><span>{hoursLabel(max / 2)}</span><span>0</span></div>
      <div className={`${styles.chartPlot} ${interval === "month" ? styles.monthPlot : ""}`} style={{ "--days": dayCount } as CSSProperties}>{days.map((day, index) => {
        const number = index + 1;
        const showLabel = interval === "week" || number === 1 || (number % 5 === 0 && number <= dayCount - 2) || number === dayCount;
        return <button key={day.date} className={styles.dayBar} aria-pressed={selected.date === day.date} aria-describedby={detailId} aria-label={`${fullDate(day.date)}: ${dayValue(day)}`} onClick={() => setSelectedDate(day.date)}>
          <span className={styles.barSpace}><span className={`${styles.chartBar} ${day.minutes === null ? styles.missingBar : ""}`} style={{ transform: `scaleY(${day.minutes === null ? 0 : Math.max(.0125, day.minutes / max)})` }} />{day.minutes === null && <span className={styles.missingMark} aria-hidden="true">—</span>}</span>
          <span className={styles.dayDate} aria-hidden="true">{showLabel ? interval === "week" ? ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"][index] : number : "\u00a0"}</span>
        </button>;
      })}</div>
    </div>
    <div className={styles.chartDetail} id={detailId} aria-live="polite"><span>{fullDate(selected.date)}</span><strong>{dayValue(selected)}</strong></div>
    <p className={styles.caption}>Her sütun bir gün. Bugünün süresi değişebilir; eksik kayıt sıfır sayılmaz.</p>
  </section>;
}
