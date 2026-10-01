"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  pointerWithin,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import {
  Check,
  ChartNoAxesColumn,
  ChevronLeft,
  ChevronRight,
  ClipboardPen,
  LoaderCircle,
  LockKeyhole,
  Plus,
  RefreshCw,
  UserRound,
  X,
} from "lucide-react";
import {
  addDays,
  dateLabel,
  isLocked,
  today,
  weekDates,
  weekLabel,
  weekStart,
} from "@/lib/dates";
import type { Category, Task, TaskInput, Theme, WeekData } from "@/lib/types";
import DayCard from "./DayCard";
import TaskItem, { TaskVisual } from "./TaskItem";
import TaskModal from "./TaskModal";
import CopyTaskModal from "./CopyTaskModal";
import StudyTime, { type StudyTimeHandle } from "./StudyTime";
import DropTaskModal from "./DropTaskModal";
import ProfileModal from "./ProfileModal";
import Modal from "@/components/ui/Modal";
import { readNoteDraft, storeNoteDraft } from "@/lib/note-drafts";
import { canRecordStudyTime } from "@/lib/study-time";
import { applyTaskSnapshot } from "@/lib/planner-state";

type ModalState =
  | { kind: "new" }
  | { kind: "edit" | "copy"; task: Task }
  | { kind: "profile" }
  | { kind: "drop"; task: Task; date: string; before_id: string | null }
  | null;
type Toast = { text: string; undoId?: string; expires?: number };
const empty: WeekData = { tasks: [], notes: [], statuses: [] };
const collision: CollisionDetection = (args) => {
  const pointer = pointerWithin(args);
  return pointer.length ? pointer : closestCenter(args);
};

export default function Planner({
  userId,
  categories: initialCategories,
  initialToday,
  initialNow,
  username,
  initialTheme,
  initialDate,
  initialTask,
}: {
  userId: string;
  categories: Category[];
  initialToday: string;
  initialNow: number;
  username: string;
  initialTheme: Theme;
  initialDate?: string;
  initialTask?: string;
}) {
  const router = useRouter();
  const openingDate = initialDate ?? initialToday;
  const [currentTime, setCurrentTime] = useState(initialNow);
  const taskOpened = useRef(false);
  const [activeTask, setActiveTask] = useState(initialTask);
  const studyRef = useRef<StudyTimeHandle>(null);
  const [studySaving, setStudySaving] = useState(false);
  const [taskBusy, setTaskBusy] = useState(false);
  const taskBusyRef = useRef(false);
  const [categories, setCategories] = useState(initialCategories);
  const [theme, setTheme] = useState(initialTheme);
  const [exporting, setExporting] = useState(false);
  const accents = theme === "paper";
  const [start, setStart] = useState(weekStart(openingDate)),
    [selected, setSelected] = useState(openingDate),
    [currentDay, setCurrentDay] = useState(initialToday);
  const [data, setData] = useState<WeekData>(empty),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [loadError, setLoadError] = useState("");
  const [modal, setModal] = useState<ModalState>(null),
    [toast, setToast] = useState<Toast | null>(null),
    [dragId, setDragId] = useState<string | null>(null);
  const [note, setNote] = useState({
      date: openingDate,
      content: "",
      saved: "",
      revision: 0,
    }),
    [noteOpen, setNoteOpen] = useState(true),
    [noteSaving, setNoteSaving] = useState(false),
    [noteFailed, setNoteFailed] = useState(false);
  const [noteConflict, setNoteConflict] = useState<{ content: string; revision: number } | null>(null);
  const [compareNotes, setCompareNotes] = useState(false);
  const [lockedNoteDate, setLockedNoteDate] = useState<string | null>(null);
  const pendingNote = useRef<Promise<boolean> | null>(null);
  const busyRef = useRef(false),
    selectedRef = useRef(selected),
    noteRef = useRef(note),
    dataRef = useRef(data),
    abortRef = useRef<AbortController | null>(null),
    weekStrip = useRef<HTMLDivElement>(null);
  const startRef = useRef(start);
  const inFlightWeek = useRef<{ week: string; promise: Promise<boolean> } | null>(null);
  startRef.current = start;
  selectedRef.current = selected;
  noteRef.current = note;
  dataRef.current = data;
  const dates = useMemo(() => weekDates(start), [start]);
  const dayTasks = data.tasks.filter((t) => t.date === selected),
    completed = dayTasks.filter((t) => t.completed).length;
  const finished = data.statuses.some(
      (s) => s.date === selected && s.is_finished,
    ),
    locked = isLocked(selected, finished, new Date(currentTime)) || lockedNoteDate === selected;
  const working = busy || loading || studySaving;
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 220, tolerance: 6 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const draftStorage = useCallback((date: string, content: string, saved: string, revision: number) => {
    try { return storeNoteDraft(window.localStorage, userId, date, content === saved ? null : { content, revision }); }
    catch { return false; }
  }, [userId]);
  const noteForDate = useCallback((date: string, notes: WeekData["notes"]) => {
    const row = notes.find((n) => n.date === date);
    const saved = row?.content ?? "";
    let draft = null;
    try { draft = readNoteDraft(window.localStorage, userId, date); } catch { /* Storage may be unavailable. */ }
    if (draft?.content === saved) { draftStorage(date, saved, saved, row?.revision ?? 0); draft = null; }
    return { date, content: draft?.content ?? saved, saved, revision: draft?.revision ?? row?.revision ?? 0 };
  }, [userId, draftStorage]);
  const loadWeek = useCallback(async (week: string, initial = false) => {
    if (inFlightWeek.current?.week === week && !abortRef.current?.signal.aborted)
      return inFlightWeek.current.promise;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    if (initial) setLoading(true);
    setLoadError("");
    const promise = (async () => {
    try {
      const response = await fetch(`/api/planner?start=${week}`, {
        signal: controller.signal,
        cache: "no-store",
      });
      if (response.status === 401) {
        window.location.assign("/login");
        return false;
      }
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      if (controller.signal.aborted || startRef.current !== week) return false;
      setData(result);
      const date = selectedRef.current;
      setNote((previous) =>
        previous.date !== date || previous.content === previous.saved
          ? noteForDate(date, result.notes)
          : previous,
      );
      return true;
    } catch (error) {
      if (controller.signal.aborted) return false;
      setLoadError(
        error instanceof Error
          ? error.message
          : "Plan yüklenemedi. Tekrar dene.",
      );
      return false;
    } finally {
      if (abortRef.current === controller) {
        inFlightWeek.current = null;
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    })();
    inFlightWeek.current = { week, promise };
    return promise;
  }, [noteForDate]);
  useEffect(() => {
    // Strict Mode replays setup/cleanup; only the surviving setup sends a request.
    let cancelled = false;
    queueMicrotask(() => { if (!cancelled) void loadWeek(start, true); });
    return () => { cancelled = true; abortRef.current?.abort(); };
  }, [start, loadWeek]);
  useEffect(() => {
    if (!initialTask || loading || loadError || taskOpened.current) return;
    taskOpened.current = true;
    const row = [...document.querySelectorAll<HTMLElement>("[data-task-id]")].find((element) => element.dataset.taskId === initialTask);
    if (row) {
      row.scrollIntoView({ block: "center", behavior: "instant" });
      row.focus({ preventScroll: true });
    } else setToast({ text: "Bu görev artık bu günde bulunmuyor. Güncel planı görebilirsin." });
  }, [initialTask, loading, loadError, data.tasks]);
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
      setCurrentDay(today());
      if (!busyRef.current && !taskBusyRef.current) loadWeek(start);
    }, 60000);
    const refresh = () => {
      setCurrentTime(Date.now());
      setCurrentDay(today());
      if (document.visibilityState === "visible" && !busyRef.current && !taskBusyRef.current)
        loadWeek(start);
    };
    setCurrentTime(Date.now());
    setCurrentDay(today());
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [start, loadWeek]);
  useEffect(() => {
    const date = today(new Date(currentTime));
    const close = Date.parse(`${date}T23:59:00+03:00`);
    const next = currentTime < close ? close : Date.parse(`${addDays(date, 1)}T00:00:00+03:00`);
    const timer = setTimeout(() => { setCurrentTime(Date.now()); setCurrentDay(today()); }, Math.max(1, next - Date.now() + 10));
    return () => clearTimeout(timer);
  }, [currentTime]);
  useEffect(() => {
    if (selected === openingDate && !initialDate && !activeTask && !window.location.search) return;
    const params = new URLSearchParams({ date: selected });
    if (activeTask) params.set("task", activeTask);
    const url = `/?${params}`;
    if (window.location.pathname + window.location.search !== url) window.history.replaceState(null, "", url);
  }, [selected, activeTask, openingDate, initialDate]);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    return () => {
      delete document.documentElement.dataset.theme;
    };
  }, [theme]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(
      () => setToast(null),
      toast.expires ? Math.max(0, toast.expires - Date.now()) : 4500,
    );
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    const card = weekStrip.current?.querySelector<HTMLElement>(
      `[data-date="${selected}"]`,
    );
    if (card && window.innerWidth < 768)
      card.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
        block: "nearest",
        inline: "center",
      });
  }, [selected]);

  const mutate = useCallback(
    async (
      action: string,
      payload: Record<string, unknown>,
      success?: string,
    ): Promise<Record<string, unknown> | null> => {
      if (busyRef.current || taskBusyRef.current) return null;
      taskBusyRef.current = true;
      setTaskBusy(true);
      // Discard a refresh started before this write; it could restore old data.
      abortRef.current?.abort();
      const original = dataRef.current.tasks.find((task) => task.id === payload.id);
      if (action === "toggle" && original)
        setData((previous) => ({ ...previous, tasks: previous.tasks.map((task) => task.id === original.id ? { ...task, completed: !original.completed } : task) }));
      let failed = false;
      try {
        const response = await fetch("/api/planner", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, data: payload }),
        });
        if (response.status === 401) {
          window.location.assign("/login");
          return null;
        }
        const result = await response.json();
        if (!response.ok) throw new Error(result.error);
        setData((previous) => applyTaskSnapshot(previous, result.dates, result.tasks, startRef.current));
        if (success) setToast({ text: success });
        return result;
      } catch (error) {
        failed = true;
        if (action === "toggle" && original)
          setData((previous) => ({ ...previous, tasks: previous.tasks.map((task) => task.id === original.id ? original : task) }));
        setToast({
          text:
            error instanceof Error
              ? error.message
              : "İşlem kaydedilemedi. Tekrar dene.",
        });
        return null;
      } finally {
        taskBusyRef.current = false;
        setTaskBusy(false);
        if (failed) void loadWeek(startRef.current);
      }
    },
    [loadWeek],
  );
  const persistNote = useCallback(async (expectedRevision?: number) => {
    if (pendingNote.current && !(await pendingNote.current)) return false;
    const current = noteRef.current;
    const dayFinished = dataRef.current.statuses.some((s) => s.date === current.date && s.is_finished);
    if (isLocked(current.date, dayFinished) || lockedNoteDate === current.date) {
      if (current.content === current.saved) return true;
      const stored = draftStorage(current.date, current.content, current.saved, current.revision);
      setNoteFailed(true);
      setToast({ text: stored ? "Gün kapandı. Notun bu cihazda taslak olarak saklandı." : "Taslak saklanamadı. Ayrılmadan önce notunu kopyala." });
      return stored;
    }
    if (noteConflict && expectedRevision === undefined) { setCompareNotes(true); return false; }
    if (current.content === current.saved && expectedRevision === undefined) return true;
    if (busyRef.current) return false;
    busyRef.current = true;
    setBusy(true);
    setNoteSaving(true);
    const operation = (async () => {
      try {
        const response = await fetch("/api/planner", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "note", data: { date: current.date, content: current.content, revision: expectedRevision ?? current.revision } }),
        });
        if (response.status === 401) { window.location.assign("/login"); return false; }
        const result = await response.json();
        if (response.status === 423) {
          setLockedNoteDate(current.date);
          setNoteFailed(true);
          const latest = noteRef.current;
          const stored = draftStorage(latest.date, latest.content, latest.saved, latest.revision);
          setToast({ text: stored ? "Gün kapandı. Notun bu cihazda taslak olarak saklandı." : "Taslak saklanamadı. Ayrılmadan önce notunu kopyala." });
          return stored;
        }
        if (response.status === 409 && result.current) {
          setNoteConflict(result.current);
          setCompareNotes(true);
          setNoteFailed(true);
          return false;
        }
        if (!response.ok) throw new Error(result.error);
        const latest = noteRef.current;
        const next = { ...latest, saved: current.content, revision: result.revision };
        noteRef.current = next;
        setNote(next);
        setData((previous) => ({ ...previous, notes: [...previous.notes.filter((n) => n.date !== current.date), result] }));
        draftStorage(next.date, next.content, next.saved, next.revision);
        setNoteFailed(false);
        setNoteConflict(null);
        setCompareNotes(false);
        return true;
      } catch (error) {
        setNoteFailed(true);
        setToast({ text: error instanceof Error ? error.message : "Not kaydedilemedi. Tekrar dene." });
        return false;
      } finally {
        pendingNote.current = null;
        busyRef.current = false;
        setBusy(false);
        setNoteSaving(false);
      }
    })();
    pendingNote.current = operation;
    return operation;
  }, [draftStorage, lockedNoteDate, noteConflict]);
  async function persistDay() {
    if (!(await persistNote())) return false;
    if (!locked && noteRef.current.content !== noteRef.current.saved && !(await persistNote())) return false;
    return studyRef.current?.canLeave() ?? true;
  }
  useEffect(() => {
    if (note.content === note.saved || busy || loading || locked || noteFailed)
      return;
    const timer = setTimeout(() => {
      persistNote();
    }, 900);
    return () => clearTimeout(timer);
  }, [note, busy, loading, locked, noteFailed, persistNote]);
  useEffect(() => {
    if (locked && note.content !== note.saved) {
      draftStorage(note.date, note.content, note.saved, note.revision);
      setNoteFailed(true);
    }
  }, [locked, note, draftStorage]);
  async function selectDate(date: string) {
    if (working || date === selected) return;
    if (!(await persistDay())) return;
    selectedRef.current = date;
    setSelected(date);
    setActiveTask(undefined);
    setNoteFailed(false);
    setNoteConflict(null);
    setCompareNotes(false);
    setNote(noteForDate(date, dataRef.current.notes));
  }
  async function changeWeek(delta: number) {
    if (working || !(await persistDay())) return;
    const next = addDays(start, delta * 7),
      date = addDays(selected, delta * 7);
    selectedRef.current = date;
    setSelected(date);
    setActiveTask(undefined);
    setNoteFailed(false);
    setNoteConflict(null);
    setCompareNotes(false);
    setNote(noteForDate(date, []));
    setData(empty);
    setStart(next);
  }
  async function goCurrent() {
    if (working || !(await persistDay())) return;
    const date = today();
    selectedRef.current = date;
    setSelected(date);
    setActiveTask(undefined);
    setNoteFailed(false);
    setNoteConflict(null);
    setCompareNotes(false);
    setNote(noteForDate(date, dataRef.current.notes));
    if (start !== weekStart(date)) {
      setData(empty);
      setStart(weekStart(date));
    }
  }
  async function deleteTask(task: Task) {
    const result = await mutate("delete", {
      id: task.id,
      updated_at: task.updated_at,
    });
    if (result) {
      setModal(null);
      setToast({
        text: "Görev silindi",
        undoId: task.id,
        expires: Date.parse(String(result.expires_at)),
      });
    }
  }
  async function saveTask(input: TaskInput) {
    const task = modal && "task" in modal ? modal.task : null;
    const result = await mutate(
      task ? "edit" : "create",
      {
        ...input,
        ...(task
          ? { id: task.id, updated_at: task.updated_at }
          : { date: selected }),
      },
      task ? "Görev güncellendi." : "Görev eklendi.",
    );
    if (result) setModal(null);
    return !!result;
  }
  async function endDrag(event: DragEndEvent) {
    setDragId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const task = data.tasks.find((t) => t.id === active.id);
    if (!task) return;
    let target = selected,
      before_id: string | null = null;
    if (String(over.id).startsWith("day:")) target = String(over.id).slice(4);
    else {
      const overTask = data.tasks.find((t) => t.id === over.id);
      if (!overTask) return;
      target = overTask.date;
      const tasks = data.tasks.filter((t) => t.date === target);
      const oldIndex = tasks.findIndex((t) => t.id === task.id),
        newIndex = tasks.findIndex((t) => t.id === overTask.id);
      if (oldIndex >= 0) {
        const sorted = arrayMove(tasks, oldIndex, newIndex);
        before_id = sorted[newIndex + 1]?.id ?? null;
      } else before_id = overTask.id;
    }
    if (target !== task.date) {
      setModal({ kind: "drop", task, date: target, before_id });
      return;
    }
    await mutate("move", {
      id: task.id,
      updated_at: task.updated_at,
      date: target,
      before_id,
    });
  }
  async function exportWeek() {
    if (exporting || !(await persistDay())) return;
    setExporting(true);
    try {
      const res = await fetch(`/api/export?start=${start}`);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error);
      }
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = `haftalik-plan-${start}.pdf`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setToast({ text: "Haftanın PDF’si indirildi." });
    } catch (error) {
      setToast({
        text:
          error instanceof Error
            ? error.message
            : "PDF hazırlanamadı. Tekrar dene.",
      });
    } finally {
      setExporting(false);
    }
  }
  async function savePreferences(
    nextTheme: Theme,
    colors: { id: string; accent_color: string }[],
  ) {
    if (busyRef.current) return false;
    busyRef.current = true;
    setBusy(true);
    try {
      const response = await fetch("/api/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme: nextTheme, colors }),
      });
      if (response.status === 401) {
        window.location.assign("/login");
        return false;
      }
      if (!response.ok) return false;
      const result = await response.json();
      setCategories(result.categories);
      setTheme(result.theme);
      return true;
    } catch {
      return false;
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }
  async function logout() {
    if (!(await persistDay())) return;
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) throw new Error();
      window.location.assign("/login");
    } catch {
      setToast({ text: "Çıkış yapılamadı. Tekrar dene." });
    }
  }
  useEffect(() => {
    function shortcuts(event: KeyboardEvent) {
      if (
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        event.shiftKey ||
        modal ||
        busyRef.current ||
        loading ||
        window.innerWidth < 1024
      )
        return;
      const el = event.target as HTMLElement;
      if (
        el.closest(
          'input,textarea,select,[contenteditable="true"],[role="menu"]',
        )
      )
        return;
      if (event.key.toLowerCase() === "n" && !locked) {
        event.preventDefault();
        setModal({ kind: "new" });
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        changeWeek(-1);
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        changeWeek(1);
      }
    }
    window.addEventListener("keydown", shortcuts);
    return () => window.removeEventListener("keydown", shortcuts);
  });
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (noteRef.current.content !== noteRef.current.saved) {
        const current = noteRef.current;
        if (isLocked(current.date, dataRef.current.statuses.some((s) => s.date === current.date && s.is_finished)) && draftStorage(current.date, current.content, current.saved, current.revision)) return;
        event.preventDefault(); event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [draftStorage]);
  const dragged = data.tasks.find((t) => t.id === dragId);

  return (
    <main className={`planner-shell ${accents ? "" : "monochrome"}`}>
      <header className="week-header">
        <h1>
          Haftalık Plan<span className="wordmark-dot">.</span>
        </h1>
        <div className="week-navigation">
          <div className="week-nav-controls">
            <button
              className="icon-button bordered"
              aria-label="Önceki hafta"
              disabled={working}
              onClick={() => changeWeek(-1)}
            >
              <ChevronLeft />
            </button>
            <button
              className="button secondary this-week"
              disabled={working}
              onClick={goCurrent}
            >
              Bu hafta
            </button>
            <button
              className="icon-button bordered"
              aria-label="Sonraki hafta"
              disabled={working}
              onClick={() => changeWeek(1)}
            >
              <ChevronRight />
            </button>
          </div>
          <div className="week-caption">
            <span className="week-range" aria-live="polite">{weekLabel(start)}</span>
            <button className="analysis-entry" disabled={working} onClick={async () => {
              if (await persistDay()) router.push(`/analiz?start=${start}`);
            }}><ChartNoAxesColumn size={16} /> Analiz</button>
          </div>
        </div>
        <div className="header-end">
          <div className="weekly-progress" aria-label="Haftalık ilerleme">
            <strong>
              {data.tasks.filter((t) => t.completed).length}{" "}
              <span>/ {data.tasks.length}</span>
            </strong>
            <span>tamamlandı</span>
          </div>
          <button
            className="icon-button account-button bordered"
            aria-label="Profil ve ayarlar"
            disabled={working || exporting}
            onClick={() => {
              setToast(null);
              setModal({ kind: "profile" });
            }}
          >
            <UserRound size={21} />
          </button>
        </div>
      </header>
      <DndContext
        sensors={sensors}
        collisionDetection={collision}
        onDragStart={(event) => setDragId(String(event.active.id))}
        onDragCancel={() => setDragId(null)}
        onDragEnd={endDrag}
        accessibility={{
          screenReaderInstructions: {
            draggable:
              "Görevi taşımak için boşluk tuşuna bas. Ok tuşlarıyla hareket ettir, boşluk ile bırak, Escape ile iptal et.",
          },
          announcements: {
            onDragStart: () => "Görev alındı.",
            onDragOver: ({ over }) => (over ? "Hedef seçildi." : ""),
            onDragEnd: () => "Görev bırakıldı.",
            onDragCancel: () => "Taşıma iptal edildi.",
          },
        }}
      >
        <div className="week-strip" ref={weekStrip}>
          <div className="week-grid">
            {dates.map((date) => (
              <DayCard
                key={date}
                date={date}
                currentTime={currentTime}
                tasks={data.tasks.filter((t) => t.date === date)}
                categories={categories}
                selected={date === selected}
                isToday={date === currentDay}
                finished={data.statuses.some(
                  (s) => s.date === date && s.is_finished,
                )}
                accents={accents}
                busy={working}
                onSelect={() => selectDate(date)}
              />
            ))}
          </div>
        </div>
        <section
          className="day-detail"
          aria-label="Seçili günün planı"
          aria-busy={loading}
        >
          <div className="detail-header">
            <div>
              <div className="day-title-row">
                <h2>
                  {dateLabel(selected, {
                    day: "numeric",
                    month: "long",
                    weekday: "long",
                  })}
                </h2>
                {locked && (
                  <span className="locked-badge">
                    <LockKeyhole size={12} />
                    {finished ? "Gün tamamlandı" : "Geçmiş gün"}
                  </span>
                )}
              </div>
              <p>
                {dayTasks.length} görev <span>·</span> {completed} tamamlandı
              </p>
            </div>
            {!locked && (
              <button
                className="button primary add-task"
                disabled={working || taskBusy}
                onClick={() => setModal({ kind: "new" })}
              >
                <Plus size={20} />
                <span>Görev ekle</span>
              </button>
            )}
          </div>
          {loadError && (
            <div className="load-error" role="alert">
              <span>{loadError}</span>
              <button
                className="text-button"
                onClick={() => loadWeek(start, true)}
              >
                <RefreshCw size={16} />
                Tekrar dene
              </button>
            </div>
          )}
          <div className="detail-body" key={selected}>
            <div className="task-list">
              {loading ? (
                <div className="task-skeletons">
                  {[1, 2, 3].map((i) => (
                    <div className="skeleton skeleton-task" key={i} />
                  ))}
                </div>
              ) : !dayTasks.length ? (
                <div className="empty-day">
                  <span className="empty-rule" />
                  <h3>Bugün için görev yok.</h3>
                  <p>
                    {locked
                      ? "Bu günün planı boş."
                      : "İlk görevini ekle, günün planı burada şekillensin."}
                  </p>
                  {!locked && (
                    <button
                      className="button secondary"
                      disabled={busy || taskBusy}
                      onClick={() => setModal({ kind: "new" })}
                    >
                      <Plus size={18} />
                      Görev ekle
                    </button>
                  )}
                </div>
              ) : (
                <SortableContext
                  items={dayTasks.map((t) => t.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {dayTasks.map((task) => (
                    <TaskItem
                      key={task.id}
                      task={task}
                      highlighted={task.id === activeTask}
                      category={categories.find(
                        (c) => c.id === task.category_id,
                      )!}
                      accents={accents}
                      locked={locked}
                      busy={busy || taskBusy}
                      onToggle={() =>
                        mutate("toggle", {
                          id: task.id,
                          updated_at: task.updated_at,
                        })
                      }
                      onEdit={() => setModal({ kind: "edit", task })}
                      onCopy={() => setModal({ kind: "copy", task })}
                      onDelete={() => deleteTask(task)}
                    />
                  ))}
                </SortableContext>
              )}
            </div>
            <aside className={`day-note ${noteOpen ? "" : "collapsed"}`}>
              <div className="note-heading">
                <ClipboardPen size={20} />
                <h3>Günün notu</h3>
                <button
                  className="icon-button note-toggle"
                  aria-label={
                    noteOpen ? "Günün notunu daralt" : "Günün notunu aç"
                  }
                  aria-expanded={noteOpen}
                  onClick={() => setNoteOpen(!noteOpen)}
                >
                  <ChevronRight size={18} />
                </button>
              </div>
              <div className="note-content">
                <textarea
                  aria-label="Günün notu"
                  placeholder={
                    locked
                      ? "Bu gün için not yazılmamış."
                      : "Bugün nasıl geçti?\nYarın için aklında ne var?"
                  }
                  maxLength={500}
                  readOnly={locked}
                  disabled={loading}
                  rows={6}
                  value={note.content}
                  onChange={(event) => {
                    if (!noteConflict) setNoteFailed(false);
                    const next = { ...noteRef.current, content: event.target.value };
                    noteRef.current = next;
                    setNote(next);
                    draftStorage(next.date, next.content, next.saved, next.revision);
                  }}
                  onBlur={() => {
                    if (!busyRef.current && !locked) persistNote();
                  }}
                />
                <div className="note-meta">
                  <span aria-live="polite">
                    {noteSaving ? (
                      <>
                        <LoaderCircle size={12} className="spinner" />
                        Kaydediliyor…
                      </>
                    ) : locked ? (
                      note.content !== note.saved ? "Bu cihazdaki taslak" : "Yalnızca okunabilir"
                    ) : note.content !== note.saved ? (
                      <button
                        className="text-button"
                        onClick={() => persistNote()}
                        disabled={busy}
                      >
                        {noteConflict ? "Notları karşılaştır" : "Notu kaydet"}
                      </button>
                    ) : note.content ? (
                      <>
                        <Check size={12} />
                        Kaydedildi
                      </>
                    ) : null}
                  </span>
                  <span>{note.content.length} / 500</span>
                </div>
                {locked && note.content !== note.saved && <div className="note-draft-notice" role="status">
                  <p>Gün kapandı. Bu taslak planına kaydedilmedi; bu cihazda saklanır.</p>
                  <button className="button secondary" onClick={async () => {
                    try { await navigator.clipboard.writeText(note.content); setToast({ text: "Taslak kopyalandı." }); }
                    catch { setToast({ text: "Kopyalanamadı. Not metnini seçip kopyalayabilirsin." }); }
                  }}>Taslağı kopyala</button>
                </div>}
              </div>
              {!loading && selected <= currentDay && <StudyTime key={selected} ref={studyRef} date={selected} editable={canRecordStudyTime(selected, finished, new Date(currentTime))} onSaving={setStudySaving} disabled={busy} />}
            </aside>
          </div>
        </section>
        <DragOverlay
          dropAnimation={
            modal?.kind === "drop"
              ? null
              : { duration: 180, easing: "ease-out" }
          }
        >
          {dragged && (
            <div className="task-row drag-overlay">
              <span className="completion">
                {dragged.completed && <Check size={17} />}
              </span>
              <TaskVisual
                task={dragged}
                category={categories.find((c) => c.id === dragged.category_id)!}
                accents={accents}
              />
            </div>
          )}
        </DragOverlay>
      </DndContext>
      <Modal title="Notları karşılaştır" description="Not başka bir cihazda değişti. Hangi değeri kullanacağını seç." open={compareNotes && !!noteConflict} onClose={() => setCompareNotes(false)} busy={busy}>
        <div className="note-comparison">
          <label>Bu cihazdaki taslak<textarea aria-label="Bu cihazdaki taslak" readOnly value={note.content} rows={5} /></label>
          <label>Güncel kayıt<textarea aria-label="Güncel kayıt" readOnly value={noteConflict?.content ?? ""} rows={5} /></label>
        </div>
        <div className="modal-actions">
          <button className="button secondary" disabled={busy} onClick={() => {
            if (!noteConflict) return;
            const next = { date: note.date, content: noteConflict.content, saved: noteConflict.content, revision: noteConflict.revision };
            noteRef.current = next; setNote(next);
            setData((previous) => ({ ...previous, notes: [...previous.notes.filter((n) => n.date !== next.date), {
              ...previous.notes.find((n) => n.date === next.date), id: previous.notes.find((n) => n.date === next.date)?.id ?? "", user_id: userId,
              date: next.date, content: next.content, revision: next.revision, created_at: "", updated_at: "",
            }] }));
            draftStorage(next.date, next.content, next.saved, next.revision);
            setNoteConflict(null); setCompareNotes(false); setNoteFailed(false);
          }}>Güncel notu kullan</button>
          <button className="button primary" disabled={busy} onClick={() => void persistNote(noteConflict?.revision)}>Taslağımı kaydet</button>
        </div>
      </Modal>
      {modal?.kind === "profile" && (
        <ProfileModal
          username={username}
          categories={categories}
          theme={theme}
          start={start}
          busy={busy || taskBusy}
          exporting={exporting}
          onClose={() => setModal(null)}
          onSave={savePreferences}
          onExport={exportWeek}
          onLogout={logout}
        />
      )}
      {(modal?.kind === "new" || modal?.kind === "edit") && (
        <TaskModal
          key={modal.kind === "edit" ? modal.task.id : "new"}
          task={modal.kind === "edit" ? modal.task : null}
          categories={categories}
          busy={busy || taskBusy}
          onClose={() => setModal(null)}
          onSave={saveTask}
          onDelete={() => {
            if (modal.kind === "edit") deleteTask(modal.task);
          }}
          onCopy={() => {
            if (modal.kind === "edit")
              setModal({ kind: "copy", task: modal.task });
          }}
        />
      )}
      {modal?.kind === "copy" && (
        <CopyTaskModal
          task={modal.task}
          start={start}
          statuses={data.statuses}
          busy={busy || taskBusy}
          onClose={() => setModal(null)}
          onCopy={async (values) => {
            const result = await mutate(
              "copy",
              {
                id: modal.task.id,
                updated_at: modal.task.updated_at,
                dates: values,
              },
              `Görev ${values.length} güne kopyalandı.`,
            );
            if (result) setModal(null);
            return !!result;
          }}
        />
      )}
      {modal?.kind === "drop" && (
        <DropTaskModal
          task={modal.task}
          date={modal.date}
          busy={busy || taskBusy}
          onClose={() => setModal(null)}
          onChoose={async (action) => {
            const result = await mutate(
              action,
              {
                id: modal.task.id,
                updated_at: modal.task.updated_at,
                ...(action === "copy"
                  ? { dates: [modal.date] }
                  : { date: modal.date, before_id: modal.before_id }),
              },
              `Görev ${dateLabel(modal.date, { weekday: "long" })} gününe ${action === "copy" ? "kopyalandı" : "taşındı"}.`,
            );
            if (result) setModal(null);
          }}
        />
      )}
      {toast && (
        <div className="toast" role="status">
          <span>{toast.text}</span>
          {toast.undoId && (
            <button
              className="undo-button"
              disabled={busy || taskBusy}
              onClick={async () => {
                const result = await mutate(
                  "restore",
                  { id: toast.undoId },
                  "Görev geri alındı.",
                );
                if (result) setToast({ text: "Görev geri alındı." });
              }}
            >
              Geri al
            </button>
          )}
          <button
            className="icon-button"
            aria-label="Bildirimi kapat"
            onClick={() => setToast(null)}
          >
            <X size={17} />
          </button>
        </div>
      )}
      <span className="sr-only" aria-live="polite">
        {busy || taskBusy ? "İşlem kaydediliyor." : ""}
      </span>
    </main>
  );
}
