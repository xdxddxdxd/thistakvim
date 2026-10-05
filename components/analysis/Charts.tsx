"use client";

import { useId, useState, type CSSProperties } from "react";
import { addDays, dateLabel, dateObject, weekLabel } from "@/lib/dates";
import { weekdayIndex, type AnalysisStudyTime } from "@/lib/analysis";
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

export function CourseDonut({ courses, total, selectedCourseId, onSelect }: { courses: { id: string; name: string; color: string; total: number }[]; total: number; selectedCourseId: string | null; onSelect: (id: string) => void }) {
  let offset = 0;
  return <div className={styles.courseDonut}>
    <div className={styles.ring} role="img" aria-label={total ? courses.map((course) => `${course.name}: ${course.total} görev`).join(", ") : "Ders dağılımı için henüz görev yok"}>
      <svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="50" className={styles.ringTrack} />{courses.map((course) => {
        const length = total ? course.total / total * 100 : 0;
        const start = offset; offset += length;
        return <circle key={course.id} cx="60" cy="60" r="50" pathLength="100" fill="none" stroke={course.color} strokeWidth="12" strokeDasharray={`${length} ${100 - length}`} strokeDashoffset={-start} opacity={selectedCourseId && selectedCourseId !== course.id ? 0.22 : 1} />;
      })}</svg><div aria-hidden="true"><strong>{total}</strong><span>görev</span></div>
    </div>
    <ul aria-label="Derse göre görev dağılımı">{courses.map((course) => <li key={course.id}><button type="button" aria-pressed={selectedCourseId === course.id} onClick={() => onSelect(course.id)}><span className={styles.dot} style={{ background: course.color }} /><span>{course.name}</span><strong>{course.total} · %{Math.round(course.total / total * 100)}</strong></button></li>)}</ul>
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
  const fullDate = (date: string) => dateLabel(date, { day: "numeric", month: "long", weekday: "long" });
  const dayValue = (day: typeof selected) => day.isFuture ? "Henüz gelmedi" : day.minutes === null ? "Kayıt yok" : duration(day.minutes);
  const shortDuration = (minutes: number) => minutes < 60 ? `${minutes}dk` : `${Number((minutes / 60).toFixed(1)).toLocaleString("tr-TR")}sa`;
  const leadingDays = interval === "week" ? 0 : weekdayIndex(firstDay);
  const weekdays = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];
  return <section className={styles.panel} aria-labelledby="trend-heading">
    <div className={styles.sectionHeading}><h2 id="trend-heading">{interval === "week" ? "Haftalık gelişim" : "Aylık gelişim"}</h2><div className={styles.smallSwitch} aria-label="Grafik aralığı"><button aria-pressed={interval === "week"} onClick={() => setInterval("week")}>Haftalık</button><button aria-pressed={interval === "month"} onClick={() => setInterval("month")}>Aylık</button></div></div>
    <p className={styles.chartPeriod}>Çalışma süresi · {interval === "week" ? weekLabel(start) : dateLabel(month, { month: "long", year: "numeric" })}</p>
    <div className={styles.calendarWeekdays} aria-hidden="true">{weekdays.map((day) => <span key={day}>{day}</span>)}</div>
    <div className={`${styles.calendarGrid} ${interval === "month" ? styles.monthCalendar : ""}`} role="group" aria-label={`${interval === "week" ? "Hafta" : "Ay"}: çalışma süreleri`}>
      {Array.from({ length: leadingDays }, (_, index) => <span key={`empty-${index}`} className={styles.calendarPlaceholder} aria-hidden="true" />)}
      {days.map((day) => <button key={day.date} type="button" className={`${styles.calendarDay} ${day.minutes !== null ? styles.calendarRecorded : day.isFuture ? styles.calendarFuture : styles.calendarMissing}`} aria-pressed={selected.date === day.date} aria-describedby={detailId} aria-label={`${fullDate(day.date)}: ${dayValue(day)}`} onClick={() => setSelectedDate(day.date)}>
        <span className={styles.calendarDate}>{dateObject(day.date).getUTCDate()}</span>
        <span className={styles.calendarDuration}>{day.minutes === null ? "—" : shortDuration(day.minutes)}</span>
      </button>)}
    </div>
    <div className={styles.chartDetail} id={detailId} aria-live="polite"><span>{fullDate(selected.date)}</span><strong>{dayValue(selected)}</strong></div>
    <p className={styles.caption}>Bir güne dokunarak kayıtlı çalışma süreni gör. Eksik kayıt, 0 dakika ve henüz gelmemiş günler ayrı gösterilir.</p>
  </section>;
}
