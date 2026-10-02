"use client";

import { useId, useState, type CSSProperties } from "react";
import { dateLabel, dateObject, weekLabel } from "@/lib/dates";
import type { AnalysisTrendWeek, AnalysisTrendMonth } from "@/lib/analysis";
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

export function TrendChart({ trend, monthlyTrend }: { trend: AnalysisTrendWeek[]; monthlyTrend: AnalysisTrendMonth[] }) {
  const [interval, setInterval] = useState<"week" | "month">("week");
  const [metric, setMetric] = useState<"minutes" | "rate">("minutes");
  const [selectedStart, setSelectedStart] = useState<string | null>(null);
  const detailId = useId();
  const weeks = interval === "week" ? trend.slice(-8) : monthlyTrend.slice(-6);
  const selected = weeks.find((week) => week.start === selectedStart) ?? weeks.at(-1);
  const value = (week: AnalysisTrendWeek) => metric === "minutes" ? week.minutes : week.total ? Math.round(week.completed / week.total * 100) : null;
  const max = metric === "rate" ? 100 : Math.max(60, ...weeks.map((week) => week.minutes ?? 0));
  const label = (amount: number | null) => metric === "minutes" ? duration(amount) : percent(amount);
  const periodLabel = (week: AnalysisTrendWeek) => interval === "week" ? weekLabel(week.start) : dateLabel(week.start, { month: "long", year: "numeric" });
  const periodDays = (week: AnalysisTrendWeek) => interval === "week" ? 7 : Math.round((dateObject((week as AnalysisTrendMonth).end).getTime() - dateObject(week.start).getTime()) / 86400000) + 1;
  const hoursLabel = (amount: number) => `${(Math.round(amount / 60 * 10) / 10).toLocaleString("tr-TR")} sa`;
  const hasData = weeks.some((week) => value(week) !== null);
  return <section className={styles.trend} aria-labelledby="trend-heading">
    <div className={styles.sectionHeading}><h2 id="trend-heading">{interval === "week" ? "Haftalık gelişim" : "Aylık gelişim"}</h2><div className={styles.smallSwitch} aria-label="Grafik aralığı"><button aria-pressed={interval === "week"} onClick={() => setInterval("week")}>Haftalık</button><button aria-pressed={interval === "month"} onClick={() => setInterval("month")}>Aylık</button></div></div>
    <div className={styles.chartControls}><div className={styles.metricSwitch} aria-label="Grafik ölçümü"><button aria-pressed={metric === "minutes"} onClick={() => setMetric("minutes")}>Çalışma süresi</button><button aria-pressed={metric === "rate"} onClick={() => setMetric("rate")}>Tamamlanma</button></div></div>
    {!hasData ? <p className={styles.chartEmpty}>{metric === "minutes" ? "Kapanmış günlere süre kaydettiğinde gelişimin burada görünecek." : "Kapanmış günlere ait görevlerin olduğunda tamamlanma grafiği burada görünecek."}</p> : <div className={styles.chartFrame}>
      <div className={styles.chartAxis} aria-hidden="true"><span>{metric === "minutes" ? hoursLabel(max) : "%100"}</span><span>{metric === "minutes" ? hoursLabel(max / 2) : "%50"}</span><span>0</span></div>
      <div className={styles.chartPlot} style={{ "--weeks": weeks.length } as CSSProperties}>{weeks.map((week) => {
        const amount = value(week);
        return <button key={week.start} className={styles.weekBar} aria-pressed={selected?.start === week.start} aria-describedby={detailId} aria-label={`${periodLabel(week)}: ${amount === null ? "Kayıt yok" : label(amount)}${week.days < periodDays(week) ? `, ${week.days} kapanmış gün` : ""}`} onClick={() => setSelectedStart(week.start)}>
          <span className={styles.barSpace}><span className={`${styles.chartBar} ${amount === null ? styles.missingBar : ""}`} style={{ transform: `scaleY(${amount === null ? 0 : Math.max(.0125, amount / max)})` }} />{amount === null && <span className={styles.missingMark}>—</span>}</span>
          <span className={styles.weekDate}>{dateLabel(week.start, interval === "week" ? { day: "numeric", month: "short" } : { month: "short" })}</span>
          {week.days < periodDays(week) && <span className={styles.partialDot} aria-hidden="true" />}
        </button>;
      })}</div>
    </div>}
    {hasData && selected && <div className={styles.chartDetail} id={detailId} aria-live="polite"><span>{periodLabel(selected)}{selected.days < periodDays(selected) ? ` · ${selected.days}/${periodDays(selected)} gün` : ""}</span><strong>{label(value(selected))}</strong><small>{metric === "minutes" ? `${selected.recordedDays} günün süresi kaydedildi` : `${selected.completed}/${selected.total} görev tamamlandı`}</small></div>}
    <p className={styles.caption}>{interval === "week" ? "Son 8 hafta" : "Son 6 ay"} · Yalnız kapanmış günler. Eksik kayıt sıfır sayılmaz; devam eden dönem kısmi gösterilir.</p>
  </section>;
}
