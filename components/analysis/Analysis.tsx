"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, Check, ChevronLeft, ChevronRight, RefreshCw, X } from "lucide-react";
import { addDays, dateLabel, weekLabel } from "@/lib/dates";
import { analyzeStudyTime, analyzeTasks, taskCounts, titleKey, weekdayIndex, weekdays, weeklySummary, type AnalysisData, type AnalysisTask } from "@/lib/analysis";
import type { Category, Theme } from "@/lib/types";
import styles from "./Analysis.module.css";
import { analysisUrl, type AnalysisFilter as Filter, type AnalysisLocation } from "@/lib/analysis-location";

const empty: AnalysisData = { tasks: [], previous: [], studyTimes: [], previousStudyTimes: [], asOf: "" };
const percent = (rate: number | null) => rate === null ? "—" : `%${rate}`;
const difference = (now: number, before: number) => `${now > before ? "+" : ""}${now - before}`;
const duration = (minutes: number | null) => minutes === null ? "—" : `${Math.floor(minutes / 60)} sa ${minutes % 60} dk`;
const durationDifference = (now: number | null, before: number | null) => now === null || before === null ? "—" : `${now > before ? "+" : now < before ? "−" : ""}${duration(Math.abs(now - before))}`;

export default function Analysis({ categories, theme, initialStart, currentStart, initialLocation }: { categories: Category[]; theme: Theme; initialStart: string; currentStart: string; initialLocation: AnalysisLocation }) {
  const [start, setStart] = useState(initialStart);
  const [scope, setScope] = useState(initialLocation.scope);
  const [section, setSection] = useState(initialLocation.section);
  const [data, setData] = useState<AnalysisData>(empty);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [filter, setFilter] = useState<Filter | null>(initialLocation.filter);
  const [limit, setLimit] = useState(20);
  const resultsHeading = useRef<HTMLHeadingElement>(null);
  const categoryMap = useMemo(() => Object.fromEntries(categories.map((category) => [category.id, category])), [categories]);
  const names = useMemo(() => Object.fromEntries(categories.map((category) => [category.id, category.name])), [categories]);
  const analysis = useMemo(() => analyzeTasks(data.tasks, scope === "week" ? start : undefined), [data.tasks, scope, start]);
  const previous = taskCounts(data.previous);
  const studyTime = useMemo(() => analyzeStudyTime(data.studyTimes, data.asOf, scope === "week" ? start : undefined), [data.studyTimes, data.asOf, scope, start]);
  const previousStudyTime = useMemo(() => analyzeStudyTime(data.previousStudyTimes, data.asOf, addDays(start, -7)), [data.previousStudyTimes, data.asOf, start]);
  const matches = useMemo(() => analysis.tasks.filter((task) =>
    (!filter?.category || task.category_id === filter.category) &&
    (filter?.day === undefined || weekdayIndex(task.date) === filter.day) &&
    (!filter?.title || titleKey(task.title) === filter.title) &&
    (!filter?.status || task.completed === (filter.status === "completed"))
  ).sort((a, b) => a.date.localeCompare(b.date) || a.position - b.position || a.id.localeCompare(b.id)), [analysis.tasks, filter]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    return () => { delete document.documentElement.dataset.theme; };
  }, [theme]);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    setLimit(20);
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
    const url = analysisUrl(start, { scope, section, filter });
    if (window.location.pathname + window.location.search !== url) window.history.replaceState(null, "", url);
  }, [start, scope, section, filter]);
  useEffect(() => {
    if (section === "tasks" && !loading) resultsHeading.current?.focus({ preventScroll: true });
  }, [section, filter, loading]);

  function showTasks(next: Filter | null) {
    setFilter(next);
    setLimit(20);
    setSection("tasks");
  }
  function count(value: number, next: Filter) {
    return value ? <button className={styles.count} aria-label={`${next.label}: ${value} görev, listeyi aç`} onClick={() => showTasks(next)}>{value}<ArrowUpRight size={12} aria-hidden="true" /></button> : <span className={styles.zero}>0</span>;
  }
  function dot(id: string) {
    return <span className={styles.dot} style={{ background: theme !== "monochrome" ? categoryMap[id]?.accent_color ?? "var(--ink)" : "var(--ink)" }} aria-hidden="true" />;
  }
  function taskLink(task: AnalysisTask) {
    return `/?date=${task.date}&task=${encodeURIComponent(task.id)}`;
  }
  const maxDay = Math.max(1, ...analysis.daily.map((day) => day.total));
  const maxStudyMinutes = Math.max(1, ...studyTime.daily.map((day) => day.totalMinutes ?? 0));

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
      <button aria-pressed={section === "tasks"} onClick={() => showTasks({ label: "Kalan görevler", status: "remaining" })}>Kalan görevler</button>
    </nav>

    {loading ? <div className={styles.message} role="status">Analiz yükleniyor…</div> : error ? <div className={styles.message} role="alert"><p>{error}</p><button className="button secondary" onClick={() => setRetry((value) => value + 1)}><RefreshCw size={17} /> Tekrar dene</button></div> : <>
      {section === "summary" && <>
        <section className={styles.summary} aria-labelledby="short-summary">
          <div className={styles.summaryCopy}><h2 id="short-summary">{scope === "week" ? "Kısa hafta özeti" : "Kısa genel özet"}</h2><p>{scope === "all" && !analysis.total ? "Henüz görev yok. Planına görev eklediğinde genel dağılımın burada görünecek." : weeklySummary(analysis, names)}</p></div>
          <div className={styles.totals}>
            <button onClick={() => showTasks(null)}><strong>{analysis.total}</strong><span>planlanan</span></button>
            <button onClick={() => showTasks({ label: "Tamamlanan görevler", status: "completed" })}><strong>{analysis.completed}</strong><span>tamamlanan</span></button>
            <button onClick={() => showTasks({ label: "Kalan görevler", status: "remaining" })}><strong>{analysis.remaining}</strong><span>kalan</span></button>
            <div><strong>{percent(analysis.rate)}</strong><span>tamamlanma</span></div>
          </div>
        </section>
        <section className={styles.studyTime} aria-labelledby="study-time-heading">
          <div className={styles.sectionHeading}><h2 id="study-time-heading">Çalışma süresi</h2><span>{scope === "week" ? "Seçili hafta" : "Tüm süre kayıtları"}</span></div>
          <div className={styles.studyOverview}>
            <div className={styles.studyTotal}><strong>{duration(studyTime.totalMinutes)}</strong><span>{scope === "week" ? "haftalık toplam" : "genel toplam"}</span><small>{studyTime.recordedDays ? `${studyTime.recordedDays} günün süresi kaydedildi` : "Henüz süre kaydı yok"}</small></div>
            {scope === "week" && <div className={styles.studyPrevious}><span>Önceki hafta · {weekLabel(addDays(start, -7))}</span><strong>{duration(previousStudyTime.totalMinutes)}</strong><small>{previousStudyTime.recordedDays ? `${previousStudyTime.recordedDays} günün süresi kaydedildi` : "Süre kaydı yok"}</small><p>Fark: <b>{durationDifference(studyTime.totalMinutes, previousStudyTime.totalMinutes)}</b></p></div>}
          </div>
          <p className={styles.caption}>{scope === "week" ? "Günlere göre kaydettiğin toplam çalışma süresi. Kaydedilmeyen günler toplama dahil edilmez; 0 dakika kaydı dahil edilir." : "Aynı haftanın gününe denk gelen tüm tarihlerdeki süreler toplanır. Örneğin Pazartesi satırı, kayıtlı bütün pazartesilerin toplamıdır."}</p>
          <div className={styles.tableScroll}><table className={styles.table}>
            <caption className="sr-only">{scope === "week" ? "Seçili haftanın günlük çalışma süreleri" : "Tüm çalışma sürelerinin haftanın günlerine göre toplamları"}</caption>
            <thead><tr><th scope="col">Gün</th><th scope="col">Çalışma süresi</th>{scope === "all" && <th scope="col">Kayıtlı gün</th>}</tr></thead>
            <tbody>{studyTime.daily.map((day) => <tr key={day.index}><th scope="row">{day.name}{day.date && <small>{dateLabel(day.date, { day: "numeric", month: "short" })}</small>}</th><td><div className={styles.studyDay}>{day.totalMinutes === null ? <span className={styles.unrecorded}>{day.isFuture ? "Henüz gelmedi" : scope === "week" ? "Kaydedilmedi" : "Kayıt yok"}</span> : <><span>{duration(day.totalMinutes)}</span><span className={styles.studyBar} aria-hidden="true"><span style={{ width: `${day.totalMinutes / maxStudyMinutes * 100}%` }} /></span></>}</div></td>{scope === "all" && <td>{day.recordedDays}</td>}</tr>)}</tbody>
          </table></div>
          {scope === "week" && <p className={styles.caption}>Toplamlar yalnız kayıtlı günleri karşılaştırır. Devam eden haftanın ve bugünün süresi henüz son sonuç değildir.</p>}
        </section>
        <div className={styles.overview}>
          <section><div className={styles.sectionHeading}><h2>Günlere göre dağılım</h2><span>Görev sayısı</span></div>
            <div className={styles.tableScroll}><table className={styles.table}><thead><tr><th scope="col">Gün</th><th scope="col">Planlanan</th><th scope="col">Biten</th><th scope="col">Kalan</th></tr></thead><tbody>
              {analysis.daily.map((day) => <tr key={day.index}><th scope="row"><span>{day.name}</span>{scope === "week" && <small>{dateLabel(addDays(start, day.index), { day: "numeric", month: "short" })}</small>}</th><td><div className={styles.dayCount}>{count(day.total, { label: `${day.name} görevleri`, day: day.index })}<span className={styles.bar} aria-hidden="true"><span style={{ width: `${day.total / maxDay * 100}%` }} /></span></div></td><td>{count(day.completed, { label: `${day.name} · tamamlanan`, day: day.index, status: "completed" })}</td><td>{count(day.remaining, { label: `${day.name} · kalan`, day: day.index, status: "remaining" })}</td></tr>)}
            </tbody></table></div>
          </section>
          <section className={styles.comparison}><h2>{scope === "week" ? "Önceki haftayla karşılaştırma" : "Genel ders ağırlığı"}</h2>
            {scope === "week" ? <><p className={styles.caption}>Önceki hafta: {weekLabel(addDays(start, -7))}</p><div className={styles.tableScroll}><table className={styles.table}><thead><tr><th scope="col">Görevler</th><th scope="col">Seçili</th><th scope="col">Önceki</th><th scope="col">Fark</th></tr></thead><tbody>
              {([['Planlanan', analysis.total, previous.total], ['Tamamlanan', analysis.completed, previous.completed], ['Kalan', analysis.remaining, previous.remaining]] as const).map(([label, current, before]) => <tr key={label}><th scope="row">{label}</th><td>{current}</td><td>{before}</td><td>{difference(current, before)}</td></tr>)}
              <tr><th scope="row">Tamamlanma</th><td>{percent(analysis.rate)}</td><td>{percent(previous.rate)}</td><td>{analysis.rate === null || previous.rate === null ? "—" : `${difference(analysis.rate, previous.rate)} puan`}</td></tr>
            </tbody></table></div><p className={styles.caption}>Devam eden haftalar için bu sayılar henüz son sonuç değildir. Görev olmayan haftanın oranı gösterilmez.</p></> : <><p className={styles.caption}>Derslerin tüm planlarındaki payı.</p><ul className={styles.courseWeights}>{analysis.categories.map((category) => <li key={category.id}><button onClick={() => showTasks({ label: names[category.id], category: category.id })}>{dot(category.id)}<span>{names[category.id] ?? "Diğer"}</span><strong>%{Math.round(category.total / analysis.total * 100)}</strong></button></li>)}</ul>{!analysis.total && <p className={styles.caption}>Dağılım için henüz görev yok.</p>}</>}
          </section>
        </div>
      </>}

      {section === "courses" && <div className={styles.courseSections}>
        <section><div className={styles.sectionHeading}><h2>Ders dağılımı</h2><span>{scope === "week" ? "Seçili hafta" : "Tüm planlar"}</span></div>
          {!analysis.total ? <p className={styles.empty}>Bu aralıkta görev yok.</p> : <div className={styles.tableScroll}><table className={styles.table}><thead><tr><th scope="col">Ders</th><th scope="col">Planlanan</th><th scope="col">Biten</th><th scope="col">Kalan</th><th scope="col">Pay</th></tr></thead><tbody>{analysis.categories.map((category) => <tr key={category.id}><th scope="row"><span className={styles.categoryName}>{dot(category.id)}{names[category.id] ?? "Diğer"}</span></th><td>{count(category.total, { label: names[category.id], category: category.id })}</td><td>{count(category.completed, { label: `${names[category.id]} · tamamlanan`, category: category.id, status: "completed" })}</td><td>{count(category.remaining, { label: `${names[category.id]} · kalan`, category: category.id, status: "remaining" })}</td><td>%{Math.round(category.total / analysis.total * 100)}</td></tr>)}</tbody></table></div>}
        </section>
        <section><div className={styles.sectionHeading}><h2>Hangi ders, hangi gün?</h2><span>Görev sayısı</span></div><p className={styles.caption}>Bir sayıya dokunarak o dersin o gündeki görevlerine ulaş.</p>
          <div className={styles.tableScroll} tabIndex={0} role="region" aria-label="Derslerin gün dağılımı tablosu"><table className={`${styles.table} ${styles.matrix}`}><thead><tr><th scope="col">Ders</th>{weekdays.map((day, index) => <th scope="col" key={day}><abbr title={day}>{["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"][index]}</abbr></th>)}</tr></thead><tbody>{categories.map((category) => { const row = analysis.categories.find((item) => item.id === category.id); return <tr key={category.id}><th scope="row"><span className={styles.categoryName}>{dot(category.id)}{category.name}</span></th>{weekdays.map((day, index) => <td key={day}>{count(row?.days[index] ?? 0, { label: `${category.name} · ${day}`, category: category.id, day: index })}</td>)}</tr>; })}</tbody></table></div>
        </section>
        <section><div className={styles.sectionHeading}><h2>Kullandığın başlıklar</h2><span>{analysis.titles.length} farklı başlık</span></div><p className={styles.caption}>Büyük/küçük harf ve fazladan boşluk farkları aynı başlıkta birleşir.</p>
          {!analysis.titles.length ? <p className={styles.empty}>Bu aralıkta kullanılan başlık yok.</p> : <div className={styles.tableScroll}><table className={styles.table}><thead><tr><th scope="col">Başlık / ders</th><th scope="col">Kullanım</th><th scope="col">Biten</th><th scope="col">Kalan</th></tr></thead><tbody>{analysis.titles.map((title) => <tr key={title.key}><th scope="row">{title.title}<small>{title.categories.map((id) => names[id] ?? "Diğer").join(" · ")}</small></th><td>{count(title.total, { label: title.title, title: title.key })}</td><td>{count(title.completed, { label: `${title.title} · tamamlanan`, title: title.key, status: "completed" })}</td><td>{count(title.remaining, { label: `${title.title} · kalan`, title: title.key, status: "remaining" })}</td></tr>)}</tbody></table></div>}
        </section>
      </div>}

      {section === "tasks" && <section aria-labelledby="task-results">
        <div className={styles.sectionHeading}><h2 id="task-results" ref={resultsHeading} tabIndex={-1}>{filter?.label ?? "Tüm görevler"}</h2><span>{matches.length} görev</span></div>
        <div className={styles.resultControls}><p>Görevi açarak planındaki gününe geç.</p>{filter && <button className="button secondary" onClick={() => showTasks(null)}><X size={16} /> Filtreyi kaldır</button>}</div>
        {!matches.length ? <div className={styles.empty}>{filter?.status === "remaining" && analysis.total ? "Bu seçimde kalan görev yok." : "Bu seçimde görev yok."}</div> : <ul className={styles.tasks}>{matches.slice(0, limit).map((task) => <li key={task.id}><Link href={taskLink(task)} aria-label={`${task.title} · ${dateLabel(task.date, { day: "numeric", month: "long", year: "numeric" })}, planda aç`}>
          <span className={`${styles.taskStatus} ${task.completed ? styles.done : ""}`} aria-label={task.completed ? "Tamamlandı" : "Tamamlanmadı"}>{task.completed && <Check size={15} />}</span>
          <span className={styles.taskText}><strong>{task.title}</strong>{task.description && <span>{task.description}</span>}<small>{dot(task.category_id)}{names[task.category_id] ?? "Diğer"} · {dateLabel(task.date, { weekday: "long", day: "numeric", month: "short", year: "numeric" })}</small></span><ArrowUpRight size={20} aria-hidden="true" />
        </Link></li>)}</ul>}
        {matches.length > limit && <button className={`button secondary ${styles.more}`} onClick={() => setLimit((value) => value + 20)}>20 görev daha göster ({matches.length - limit} kaldı)</button>}
      </section>}
      <p className={styles.footnote}>Görev analizi görev sayısına, süre analizi kaydettiğin günlük toplamlara dayanır. Taşınan görevler mevcut gününde, kopyalar ayrı görev olarak sayılır.</p>
    </>}
  </main>;
}
