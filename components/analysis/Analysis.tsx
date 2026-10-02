"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ChevronDown, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { addDays, dateLabel, weekLabel, weekStart } from "@/lib/dates";
import { analyzeStudyTime, analyzeTasks, compareClosedDays, weekdays, weeklySummary, type AnalysisData } from "@/lib/analysis";
import type { Category, Theme } from "@/lib/types";
import { analysisUrl, type AnalysisLocation } from "@/lib/analysis-location";
import { CompletionRing, CourseDonut, TrendChart, duration, percent } from "./Charts";
import styles from "./Analysis.module.css";

const empty: AnalysisData = { tasks: [], previous: [], studyTimes: [], previousStudyTimes: [], asOf: "", closedThrough: "", chartStudyTimes: [], chartMonth: "", chartMonthEnd: "" };
const difference = (now: number, before: number) => `${now > before ? "+" : ""}${now - before}`;
const durationDifference = (now: number | null, before: number | null) => now === null || before === null ? "—" : `${now > before ? "+" : now < before ? "−" : ""}${duration(Math.abs(now - before))}`;

export default function Analysis({ categories, theme, initialStart, currentStart, initialLocation }: { categories: Category[]; theme: Theme; initialStart: string; currentStart: string; initialLocation: AnalysisLocation }) {
  const [start, setStart] = useState(initialStart);
  const [scope, setScope] = useState(initialLocation.scope);
  const [section, setSection] = useState(initialLocation.section);
  const [data, setData] = useState<AnalysisData>(empty);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const categoryMap = useMemo(() => Object.fromEntries(categories.map((category) => [category.id, category])), [categories]);
  const names = useMemo(() => Object.fromEntries(categories.map((category) => [category.id, category.name])), [categories]);
  const analysis = useMemo(() => analyzeTasks(data.tasks, scope === "week" ? start : undefined), [data.tasks, scope, start]);
  const studyTime = useMemo(() => analyzeStudyTime(data.studyTimes, data.asOf, scope === "week" ? start : undefined), [data.studyTimes, data.asOf, scope, start]);
  const comparison = useMemo(() => data.closedThrough ? compareClosedDays(data, start) : null, [data, start]);
  const maxStudyMinutes = Math.max(1, ...studyTime.daily.map((day) => (scope === "all" ? day.averageMinutes : day.totalMinutes) ?? 0));
  const courses = analysis.categories.map((course) => ({ ...course, name: names[course.id] ?? "Diğer", color: categoryMap[course.id]?.accent_color ?? "var(--ink)" }));

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    return () => { delete document.documentElement.dataset.theme; };
  }, [theme]);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    fetch(`/api/analysis?start=${start}&scope=${scope}`, { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        if (response.status === 401) { window.location.assign("/login"); return; }
        const result = await response.json();
        if (!response.ok) throw new Error(result.error);
        if (!controller.signal.aborted) setData(result);
      })
      .catch((cause) => {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Analiz yüklenemedi. Tekrar dene.");
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [start, scope, retry]);
  useEffect(() => {
    const url = analysisUrl(start, { scope, section });
    if (window.location.pathname + window.location.search !== url) window.history.replaceState(null, "", url);
  }, [start, scope, section]);

  function dot(id: string) {
    return <span className={styles.dot} style={{ background: categoryMap[id]?.accent_color ?? "var(--ink)" }} aria-hidden="true" />;
  }

  return <main className={styles.shell}>
    <header className={styles.header}>
      <div><Link href={`/?date=${start}`} className={styles.back}><ArrowLeft size={17} /> Plana dön</Link><h1>Analiz<span className="wordmark-dot">.</span></h1></div>
      <div className={styles.period}>
        <div className={styles.scope} aria-label="Analiz aralığı">
          <button aria-pressed={scope === "week"} onClick={() => setScope("week")}>Haftalık</button>
          <button aria-pressed={scope === "all"} onClick={() => setScope("all")}>Genel</button>
        </div>
        {scope === "week" ? <div className={styles.weekControls}>
          <button className="icon-button bordered" aria-label="Önceki haftanın analizi" onClick={() => setStart(addDays(start, -7))}><ChevronLeft size={20} /></button>
          <div><span aria-live="polite">{weekLabel(start)}</span><button onClick={() => setStart(currentStart)} disabled={start === currentStart}>Bu hafta</button></div>
          <button className="icon-button bordered" aria-label="Sonraki haftanın analizi" onClick={() => setStart(addDays(start, 7))}><ChevronRight size={20} /></button>
        </div> : <p className={styles.generalPeriod}>Tüm planlanan günler</p>}
      </div>
    </header>
    <nav className={styles.sections} aria-label="Analiz bölümleri">
      <button aria-pressed={section === "summary"} onClick={() => setSection("summary")}>Özet</button>
      <button aria-pressed={section === "courses"} onClick={() => setSection("courses")}>Dersler ve başlıklar</button>
    </nav>
    {loading ? <div className={styles.message} role="status">Analiz yükleniyor…</div> : error ? <div className={styles.message} role="alert"><p>{error}</p><button className="button secondary" onClick={() => setRetry((value) => value + 1)}><RefreshCw size={17} /> Tekrar dene</button></div> : <>
      {section === "summary" && <>
        <section className={`${styles.panel} ${styles.summary}`} aria-labelledby="short-summary">
          <div className={styles.summaryCopy}><h2 id="short-summary">{scope === "week" ? "Haftanın özeti" : "Genel görünüm"}</h2><p>{scope === "all" && !analysis.total ? "Henüz görev yok. Planına görev eklediğinde genel dağılımın burada görünecek." : weeklySummary(analysis, names)}</p></div>
          <CompletionRing total={analysis.total} completed={analysis.completed} rate={analysis.rate} />
        </section>
        <div className={styles.overview}>
          <section className={styles.panel} aria-labelledby="study-time-heading">
            <div className={styles.sectionHeading}><h2 id="study-time-heading">Çalışma süresi</h2><span>{scope === "week" ? "Seçili hafta" : "Tüm kayıtlar"}</span></div>
            <div className={styles.studyTotal}><strong>{duration(studyTime.totalMinutes)}</strong><span>{scope === "week" ? "haftalık toplam" : "genel toplam"}</span><small>{studyTime.recordedDays ? `${studyTime.recordedDays} günün süresi kaydedildi` : "Henüz süre kaydı yok"}</small></div>
            <div className={styles.tableScroll}><table className={styles.table}>
              <caption className="sr-only">{scope === "week" ? "Günlük çalışma süresi ve görev sayıları" : "Haftanın günlerine göre ortalama çalışma süresi"}</caption>
              <thead><tr><th scope="col">Gün</th><th scope="col">{scope === "week" ? "Süre" : "Günlük ortalama"}</th>{scope === "week" ? <><th scope="col">Plan</th><th scope="col">Biten</th></> : <th scope="col">Kayıtlı gün</th>}</tr></thead>
              <tbody>{studyTime.daily.map((day) => {
                const minutes = scope === "all" ? day.averageMinutes : day.totalMinutes;
                return <tr key={day.index}><th scope="row">{day.name}{day.date && <small>{dateLabel(day.date, { day: "numeric", month: "short" })}</small>}</th><td><div className={styles.studyDay}>{minutes === null ? <span className={styles.unrecorded}>{day.isFuture ? "Henüz gelmedi" : scope === "week" ? "Kaydedilmedi" : "Kayıt yok"}</span> : <><span>{duration(minutes)}</span><span className={styles.studyBar} aria-hidden="true"><span style={{ width: `${minutes / maxStudyMinutes * 100}%` }} /></span></>}</div></td>{scope === "week" ? <><td>{analysis.daily[day.index].total}</td><td>{analysis.daily[day.index].completed}</td></> : <td>{day.recordedDays}</td>}</tr>;
              })}</tbody>
            </table></div>
            <p className={styles.caption}>{scope === "week" ? "Bugünün süresi değişebilir. Kaydedilmeyen günler toplam dışında; 0 dakika kaydı dahildir." : "Her günün ortalaması yalnız süre kaydı olan tarihlerden hesaplanır. 0 dakika dahildir; eksik kayıt sıfır sayılmaz."}</p>
          </section>
          <div className={styles.rightColumn}>
            <TrendChart records={data.chartStudyTimes} start={scope === "week" ? start : weekStart(data.asOf)} month={data.chartMonth} monthEnd={data.chartMonthEnd} asOf={data.asOf} />
            {scope === "week" && comparison && <section className={styles.panel} aria-labelledby="comparison-heading">
              <div className={styles.sectionHeading}><h2 id="comparison-heading">Önceki haftayla</h2><span>{comparison.days ? `${comparison.days} kapanmış gün` : "Henüz kapanmış gün yok"}</span></div>
              {!comparison.days ? <p className={styles.caption}>Gün kapandığında iki haftanın aynı günlerini karşılaştırabileceksin.</p> : <>
                <p className={styles.comparisonPeriod}>{comparison.days === 7 ? "Pazartesi–Pazar" : comparison.days === 1 ? "Pazartesi" : `Pazartesi–${weekdays[comparison.days - 1]}`} · {weekLabel(addDays(start, -7))}</p>
                <div className={styles.tableScroll}><table className={styles.table}><thead><tr><th scope="col" /><th scope="col">Seçili</th><th scope="col">Önceki</th><th scope="col">Fark</th></tr></thead><tbody>
                  <tr><th scope="row">Biten görev</th><td>{comparison.current.completed}</td><td>{comparison.previous.completed}</td><td>{difference(comparison.current.completed, comparison.previous.completed)}</td></tr>
                  <tr><th scope="row">Tamamlanma</th><td>{percent(comparison.current.rate)}</td><td>{percent(comparison.previous.rate)}</td><td>{comparison.current.rate === null || comparison.previous.rate === null ? "—" : `${difference(comparison.current.rate, comparison.previous.rate)} puan`}</td></tr>
                  <tr><th scope="row">Süre</th><td>{duration(comparison.current.totalMinutes)}</td><td>{duration(comparison.previous.totalMinutes)}</td><td>{durationDifference(comparison.current.totalMinutes, comparison.previous.totalMinutes)}</td></tr>
                </tbody></table></div>
                <p className={styles.caption}>Yalnız kapanmış günler kıyaslanır. Süre, iki haftada da kaydı olan {comparison.pairedStudyDays}/{comparison.days} gün üzerinden karşılaştırılır.</p>
              </>}
            </section>}
          </div>
        </div>
      </>}
      {section === "courses" && <div className={styles.courseSections}>
        <section className={styles.panel} aria-labelledby="courses-heading"><div className={styles.sectionHeading}><h2 id="courses-heading">Ders dağılımı</h2><span>{scope === "week" ? "Seçili hafta" : "Tüm planlar"}</span></div>
          {!analysis.total ? <p className={styles.empty}>Bu aralıkta görev yok. Planına görev eklediğinde derslerin dağılımı burada görünecek.</p> : <div className={styles.courseOverview}><CourseDonut courses={courses} /><div className={styles.tableScroll}><table className={styles.table}><thead><tr><th scope="col">Ders</th><th scope="col">Planlanan</th><th scope="col">Biten</th></tr></thead><tbody>{courses.map((course) => <tr key={course.id}><th scope="row"><span className={styles.categoryName}>{dot(course.id)}{course.name}</span></th><td>{course.total}</td><td>{course.completed}</td></tr>)}</tbody></table></div></div>}
        </section>
        <details className={`${styles.panel} ${styles.matrixDetails}`}><summary>Derslerin gün dağılımı<ChevronDown size={18} aria-hidden="true" /></summary><div className={styles.tableScroll} tabIndex={0} role="region" aria-label="Derslerin gün dağılımı tablosu"><table className={`${styles.table} ${styles.matrix}`}><thead><tr><th scope="col">Ders</th>{weekdays.map((day, index) => <th scope="col" key={day}><abbr title={day}>{["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"][index]}</abbr></th>)}</tr></thead><tbody>{categories.map((category) => { const row = analysis.categories.find((item) => item.id === category.id); return <tr key={category.id}><th scope="row"><span className={styles.categoryName}>{dot(category.id)}{category.name}</span></th>{weekdays.map((day, index) => <td key={day}>{row?.days[index] ?? 0}</td>)}</tr>; })}</tbody></table></div></details>
        <details className={`${styles.panel} ${styles.matrixDetails}`}><summary>Kullandığın başlıklar<span className={styles.detailCount}>{analysis.titles.length} farklı başlık</span><ChevronDown size={18} aria-hidden="true" /></summary>
          {!analysis.titles.length ? <p className={styles.empty}>Bu aralıkta kullanılan başlık yok.</p> : <div className={styles.tableScroll}><table className={styles.table}><thead><tr><th scope="col">Başlık / ders</th><th scope="col">Kullanım</th><th scope="col">Biten</th></tr></thead><tbody>{analysis.titles.map((title) => <tr key={title.key}><th scope="row">{title.title}<small>{title.categories.map((id) => names[id] ?? "Diğer").join(" · ")}</small></th><td>{title.total}</td><td>{title.completed}</td></tr>)}</tbody></table></div>}
        </details>
      </div>}
      <p className={styles.footnote}>Görevler sayıya, süreler günlük kayıtlarına dayanır. Taşınan görevler mevcut gününde, kopyalar ayrı görev olarak sayılır.</p>
    </>}
  </main>;
}
