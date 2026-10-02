"use client";
import { useDroppable } from "@dnd-kit/core";
import { Check } from "lucide-react";
import { dateLabel, isLocked } from "@/lib/dates";
import type { Category, Task } from "@/lib/types";
export default function DayCard({
  date,
  currentTime,
  tasks,
  categories,
  selected,
  isToday,
  finished,
  accents,
  busy,
  onSelect,
}: {
  date: string;
  currentTime: number;
  tasks: Task[];
  categories: Category[];
  selected: boolean;
  isToday: boolean;
  finished: boolean;
  accents: boolean;
  busy: boolean;
  onSelect: () => void;
}) {
  const locked = isLocked(date, finished, new Date(currentTime)),
    { setNodeRef, isOver } = useDroppable({
      id: `day:${date}`,
      disabled: locked || busy,
      data: { type: "day", date },
    });
  return (
    <div
      ref={setNodeRef}
      className={`day-card ${selected ? "selected" : ""} ${locked ? "is-closed" : ""} ${isOver ? "drop-target" : ""} ${isToday ? "is-today" : ""}`}
      data-date={date}
      aria-current={isToday ? "date" : undefined}
    >
      <button
        className="day-select"
        onClick={onSelect}
        disabled={busy}
        aria-pressed={selected}
        aria-label={`${dateLabel(date, { weekday: "long", day: "numeric", month: "long" })}, ${tasks.length} görev`}
      >
        <span className="day-name">
          {dateLabel(date, { weekday: "short" })}
        </span>
        <span className="day-number">
          {dateLabel(date, { day: "numeric" })}
        </span>
        <span className="day-marker">
          {locked ? (
            <Check size={14} aria-label="Gün kapandı" />
          ) : isToday ? (
            <span className="today-mark" />
          ) : null}
        </span>
      </button>
      <div
        className="day-tasks"
        onClick={() => {
          if (!busy) onSelect();
        }}
      >
        {tasks.slice(0, 3).map((t) => {
          const category = categories.find((c) => c.id === t.category_id);
          return (
            <div className={`day-task ${t.completed ? "done" : ""}`} key={t.id}>
              <span
                className="category-dot"
                style={{
                  background: accents ? category?.accent_color : "currentColor",
                }}
              />
              <span>{t.title}</span>
            </div>
          );
        })}
        {tasks.length > 3 && (
          <span
            className="day-more"
            aria-label={`${tasks.length - 3} görev daha`}
          >
            +{tasks.length - 3}
          </span>
        )}
        {!tasks.length && <span className="day-empty">—</span>}
      </div>
      {selected && <span className="day-pointer" aria-hidden="true" />}
    </div>
  );
}
