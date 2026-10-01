"use client";
import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Modal from "@/components/ui/Modal";
import {
  addDays,
  dateLabel,
  isLocked,
  weekDates,
  weekLabel,
} from "@/lib/dates";
import type { DayStatus, Task } from "@/lib/types";
export default function CopyTaskModal({
  task,
  start,
  statuses,
  busy,
  onClose,
  onCopy,
}: {
  task: Task;
  start: string;
  statuses: DayStatus[];
  busy: boolean;
  onClose: () => void;
  onCopy: (dates: string[]) => Promise<boolean>;
}) {
  const [week, setWeek] = useState(start),
    [selected, setSelected] = useState<string[]>([]);
  return (
    <Modal
      title="Günlere kopyala"
      description="Görevin bir kopyasını seçtiğin günlere ekle."
      open
      onClose={onClose}
      busy={busy}
    >
      <div className="copy-preview">
        <strong>{task.title}</strong>
        {task.description && <p>{task.description}</p>}
      </div>
      <div className="copy-week-nav">
        <button
          className="icon-button"
          aria-label="Önceki hafta"
          disabled={busy}
          onClick={() => setWeek(addDays(week, -7))}
        >
          <ChevronLeft size={19} />
        </button>
        <span>{weekLabel(week)}</span>
        <button
          className="icon-button"
          aria-label="Sonraki hafta"
          disabled={busy}
          onClick={() => setWeek(addDays(week, 7))}
        >
          <ChevronRight size={19} />
        </button>
      </div>
      <div className="copy-days">
        {weekDates(week).map((date) => {
          const locked = isLocked(
            date,
            statuses.some((s) => s.date === date && s.is_finished),
          );
          return (
            <label
              className={`selection-row ${locked ? "unavailable" : ""}`}
              key={date}
            >
              <input
                type="checkbox"
                disabled={locked || busy}
                checked={selected.includes(date)}
                onChange={(e) =>
                  setSelected(
                    e.target.checked
                      ? [...selected, date]
                      : selected.filter((d) => d !== date),
                  )
                }
              />
              <span>{dateLabel(date, { weekday: "long" })}</span>
              <small>
                {dateLabel(date, { day: "numeric", month: "short" })}
              </small>
            </label>
          );
        })}
      </div>
      <div className="modal-actions">
        <span className="selection-count">{selected.length} gün seçildi</span>
        <div className="action-spacer" />
        <button className="button secondary" disabled={busy} onClick={onClose}>
          İptal
        </button>
        <button
          className="button primary"
          disabled={busy || !selected.length}
          onClick={() => onCopy(selected)}
        >
          Kopyala
        </button>
      </div>
    </Modal>
  );
}
