"use client";

import { CalendarDays, Check, Clock3, RotateCcw } from "lucide-react";
import { useState } from "react";
import styles from "./page.module.css";

const courses = {
  "Türkçe": "#ffd52a", "Matematik": "#ed3934", "Geometri": "#7771ef",
  "Fizik": "#36aafa", "Kimya": "#e681c9", "Biyoloji": "#77bd77",
  "Tarih": "#ef934e", "Coğrafya": "#a79c77", "Deneme": "#9c978b",
};

type Course = keyof typeof courses;
type Day = { short: string; name: string; minutes: number; tasks: { title: string; course: Course; done?: boolean }[] };

const week: Day[] = [
  { short: "Pzt", name: "Pazartesi", minutes: 125, tasks: [
    { title: "Paragraf", course: "Türkçe", done: true },
    { title: "Temel kavramlar", course: "Matematik", done: true },
  ] },
  { short: "Sal", name: "Salı", minutes: 150, tasks: [
    { title: "Problemler", course: "Matematik", done: true },
    { title: "Atom ve periyodik sistem", course: "Kimya", done: true },
  ] },
  { short: "Çar", name: "Çarşamba", minutes: 95, tasks: [
    { title: "Üçgenler", course: "Geometri", done: true },
    { title: "Hücre", course: "Biyoloji" },
    { title: "İlk Türk devletleri", course: "Tarih", done: true },
  ] },
  { short: "Per", name: "Perşembe", minutes: 80, tasks: [
    { title: "Kuvvet ve hareket", course: "Fizik", done: true },
    { title: "Fonksiyonlar", course: "Matematik" },
    { title: "Harita bilgisi", course: "Coğrafya" },
  ] },
  { short: "Cum", name: "Cuma", minutes: 115, tasks: [
    { title: "Sözcükte anlam", course: "Türkçe" },
    { title: "Kalıtım", course: "Biyoloji" },
  ] },
  { short: "Cmt", name: "Cumartesi", minutes: 165, tasks: [
    { title: "TYT denemesi", course: "Deneme" },
    { title: "Deneme değerlendirmesi", course: "Matematik" },
  ] },
  { short: "Paz", name: "Pazar", minutes: 50, tasks: [
    { title: "Haftalık tekrar", course: "Tarih" },
    { title: "Kimyasal bağlar", course: "Kimya" },
  ] },
];

const totalTasks = week.reduce((total, day) => total + day.tasks.length, 0);
const initialCompleted = week.flatMap((day, dayIndex) =>
  day.tasks.flatMap((task, taskIndex) => task.done ? [`${dayIndex}-${taskIndex}`] : []),
);

function duration(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return hours ? `${hours} sa${remainder ? ` ${remainder} dk` : ""}` : `${remainder} dk`;
}

export function WeeklyDemo() {
  const [selected, setSelected] = useState(3);
  const [changed, setChanged] = useState<string[]>([]);
  const done = (id: string) => initialCompleted.includes(id) !== changed.includes(id);
  const count = initialCompleted.length + changed.reduce((sum, id) => sum + (done(id) ? 1 : -1), 0);
  const active = week[selected];

  function toggle(id: string) {
    setChanged((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  return (
    <section className={styles.weekPanel} id="ornek-plan" aria-labelledby="week-heading">
      <div className={styles.weekHeader}>
        <div>
          <h2 id="week-heading"><CalendarDays size={25} aria-hidden="true" /> Haftan bir arada.</h2>
          <p>Örnek hafta · 12–18 Ekim</p>
        </div>
        <p className={styles.weekCount} aria-live="polite"><Check size={16} aria-hidden="true" /> {count} / {totalTasks} görev tamamlandı</p>
      </div>
      <p className={styles.demoInstruction}>Bir gün seç, aşağıdaki görevleri işaretle.</p>
      <div className={styles.weekGrid} role="group" aria-label="Örnek haftanın günleri">
        {week.map((day, dayIndex) => {
          const complete = day.tasks.every((_, taskIndex) => done(`${dayIndex}-${taskIndex}`));
          return (
            <button className={styles.dayCard} key={day.name} type="button" aria-pressed={selected === dayIndex}
              aria-controls="ornek-gun" aria-label={`${day.name}, ${day.tasks.length} görev`} data-complete={complete}
              onClick={() => setSelected(dayIndex)}>
              <span className={styles.dayHeading}>
                <span><span className={styles.dayShort}>{day.short}</span> <span className={styles.dayDate}>{12 + dayIndex}</span></span>
                {complete && <Check size={15} aria-hidden="true" />}
              </span>
              {day.tasks.slice(0, 2).map((task, taskIndex) => (
                <span className={styles.dayTask} key={task.title} data-done={done(`${dayIndex}-${taskIndex}`)} title={task.title}>
                  <span className={styles.courseDot} style={{ backgroundColor: courses[task.course] }} />
                  <span>{task.title}</span>
                </span>
              ))}
              {day.tasks.length > 2 && <span className={styles.moreTasks}>+{day.tasks.length - 2} görev</span>}
            </button>
          );
        })}
      </div>
      <div key={selected} className={styles.dayDetail} id="ornek-gun">
        <div className={styles.detailHeading}>
          <h3>{active.name} görevleri</h3>
          <span><Clock3 size={16} aria-hidden="true" /> {duration(active.minutes)} çalışma</span>
        </div>
        <ul className={styles.taskList} role="list">
          {active.tasks.map((task, index) => {
            const id = `${selected}-${index}`;
            return (
              <li key={id}>
                <button className={styles.taskToggle} type="button" onClick={() => toggle(id)} aria-pressed={done(id)}>
                  <span className={styles.taskCheck} aria-hidden="true">{done(id) && <Check size={13} />}</span>
                  <span className={styles.taskTitle}>{task.title}</span>
                  <span className={styles.taskCourse}><span className={styles.courseDot} style={{ backgroundColor: courses[task.course] }} />{task.course}</span>
                </button>
              </li>
            );
          })}
        </ul>
        {changed.length > 0 && (
          <button className={styles.reset} type="button" onClick={() => setChanged([])}>
            <RotateCcw size={15} aria-hidden="true" /> Örnek görevleri sıfırla
          </button>
        )}
      </div>
    </section>
  );
}
