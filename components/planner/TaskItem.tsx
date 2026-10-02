"use client";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import * as Menu from "@radix-ui/react-dropdown-menu";
import {
  Check,
  Copy,
  GripVertical,
  MoreHorizontal,
  Pencil,
  Trash2,
} from "lucide-react";
import type { Category, Task } from "@/lib/types";
export function TaskVisual({
  task,
  category,
  accents,
}: {
  task: Task;
  category: Category;
  accents: boolean;
}) {
  return (
    <>
      <span
        className="category-dot"
        style={{ background: accents ? category.accent_color : "var(--ink)" }}
      />
      <span className="task-copy">
        <strong>{task.title}</strong>
        {task.description && <span>{task.description}</span>}
        {task.note && <small className="task-note-preview">{task.note}</small>}
      </span>
    </>
  );
}
export default function TaskItem({
  task,
  category,
  locked,
  busy,
  accents,
  onToggle,
  onEdit,
  onCopy,
  onDelete,
}: {
  task: Task;
  category: Category;
  locked: boolean;
  busy: boolean;
  accents: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onCopy: () => void;
  onDelete: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id,
    disabled: locked || busy,
    data: { type: "task", date: task.date },
  });
  return (
    <div
      ref={setNodeRef}
      className={`task-row ${task.completed ? "completed" : ""} ${isDragging ? "dragging" : ""} ${locked ? "locked-row" : ""}`}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      data-task-id={task.id}
    >
      {!locked && (
        <button
          className="drag-handle"
          {...attributes}
          {...listeners}
          disabled={busy}
          aria-label={`${task.title} görevini taşı`}
        >
          <GripVertical size={18} />
        </button>
      )}
      <button
        className="completion"
        onClick={onToggle}
        disabled={locked || busy}
        aria-label={`${task.title}: ${task.completed ? "tamamlanmadı olarak işaretle" : "tamamlandı olarak işaretle"}`}
        aria-pressed={task.completed}
      >
        {task.completed && <Check size={18} strokeWidth={3} />}
      </button>
      <button
        className="task-main"
        onClick={onEdit}
        disabled={locked || busy}
        aria-label={`${task.title} görevini düzenle`}
      >
        <TaskVisual task={task} category={category} accents={accents} />
      </button>
      {!locked && (
        <Menu.Root>
          <Menu.Trigger asChild>
            <button
              className="icon-button task-menu"
              aria-label={`${task.title} işlemleri`}
              disabled={busy}
            >
              <MoreHorizontal size={21} />
            </button>
          </Menu.Trigger>
          <Menu.Portal>
            <Menu.Content className="dropdown" sideOffset={5} align="end">
              <Menu.Item onSelect={onEdit}>
                <Pencil size={16} />
                Düzenle
              </Menu.Item>
              <Menu.Item onSelect={onCopy}>
                <Copy size={16} />
                Günlere kopyala
              </Menu.Item>
              <Menu.Separator />
              <Menu.Item className="danger-text" onSelect={onDelete}>
                <Trash2 size={16} />
                Sil
              </Menu.Item>
            </Menu.Content>
          </Menu.Portal>
        </Menu.Root>
      )}
    </div>
  );
}
