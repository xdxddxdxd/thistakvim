"use client";
import { useState, type FormEvent } from "react";
import { LoaderCircle, Trash2 } from "lucide-react";
import Modal from "@/components/ui/Modal";
import type { Category, Task, TaskInput } from "@/lib/types";
export default function TaskModal({
  task,
  categories,
  busy,
  onClose,
  onSave,
  onDelete,
  onCopy,
}: {
  task: Task | null;
  categories: Category[];
  busy: boolean;
  onClose: () => void;
  onSave: (input: TaskInput) => Promise<boolean>;
  onDelete: () => void;
  onCopy: () => void;
}) {
  const [input, setInput] = useState<TaskInput>({
    category_id: task?.category_id ?? categories[0]?.id ?? "",
    title: task?.title ?? "",
    description: task?.description ?? "",
    note: task?.note ?? "",
  });
  const [error, setError] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!input.title.trim()) {
      setError("Göreve bir başlık yaz.");
      return;
    }
    setError("");
    await onSave({ ...input, title: input.title.trim() });
  }
  return (
    <Modal
      title={task ? "Görevi düzenle" : "Yeni görev"}
      open
      onClose={onClose}
      busy={busy}
    >
      <form className="task-form" onSubmit={submit}>
        <label>
          Ders / kategori
          <select
            value={input.category_id}
            onChange={(e) =>
              setInput({ ...input, category_id: e.target.value })
            }
            disabled={busy}
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Başlık
          <input
            autoFocus
            required
            maxLength={120}
            value={input.title}
            onChange={(e) => setInput({ ...input, title: e.target.value })}
            disabled={busy}
          />
        </label>
        <label>
          Açıklama
          <textarea
            rows={2}
            maxLength={1000}
            value={input.description}
            onChange={(e) =>
              setInput({ ...input, description: e.target.value })
            }
            disabled={busy}
          />
        </label>
        <label>
          Not <span className="optional">(isteğe bağlı)</span>
          <textarea
            rows={2}
            maxLength={2000}
            value={input.note}
            onChange={(e) => setInput({ ...input, note: e.target.value })}
            disabled={busy}
          />
        </label>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {task && (
          <button
            type="button"
            className="text-button copy-link"
            disabled={busy}
            onClick={onCopy}
          >
            Günlere kopyala
          </button>
        )}
        <div className="modal-actions">
          {task && (
            <button
              type="button"
              className="button danger"
              onClick={onDelete}
              disabled={busy}
            >
              <Trash2 size={16} />
              Sil
            </button>
          )}
          <div className="action-spacer" />
          <button
            type="button"
            className="button secondary"
            onClick={onClose}
            disabled={busy}
          >
            İptal
          </button>
          <button
            className="button primary"
            disabled={busy || !input.title.trim()}
          >
            {busy ? <LoaderCircle size={18} className="spinner" /> : "Kaydet"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
