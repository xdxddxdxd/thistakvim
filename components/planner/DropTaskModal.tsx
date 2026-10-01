"use client";
import Modal from "@/components/ui/Modal";
import { dateLabel } from "@/lib/dates";
import type { Task } from "@/lib/types";

export default function DropTaskModal({
  task,
  date,
  busy,
  onClose,
  onChoose,
}: {
  task: Task;
  date: string;
  busy: boolean;
  onClose: () => void;
  onChoose: (action: "copy" | "move") => Promise<void>;
}) {
  return (
    <Modal
      title="Kopyala veya taşı"
      description={`${dateLabel(date, { day: "numeric", month: "long", weekday: "long" })} gününe nasıl eklemek istersin?`}
      open
      busy={busy}
      onClose={onClose}
    >
      <div className="copy-preview">
        <strong>{task.title}</strong>
        {task.description && <p>{task.description}</p>}
      </div>
      <div className="modal-actions">
        <button className="button secondary" disabled={busy} onClick={onClose}>
          İptal
        </button>
        <div className="action-spacer" />
        <button
          className="button secondary"
          disabled={busy}
          onClick={() => onChoose("copy")}
        >
          Kopyala
        </button>
        <button
          className="button primary"
          disabled={busy}
          onClick={() => onChoose("move")}
        >
          Taşı
        </button>
      </div>
    </Modal>
  );
}
