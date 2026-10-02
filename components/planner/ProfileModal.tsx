"use client";
import { useState } from "react";
import { Check, Download, LoaderCircle, LogOut } from "lucide-react";
import Modal from "@/components/ui/Modal";
import { weekLabel } from "@/lib/dates";
import type { Category, Theme } from "@/lib/types";

export default function ProfileModal({
  username,
  categories,
  theme,
  start,
  busy,
  exporting,
  onClose,
  onSave,
  onExport,
  onLogout,
}: {
  username: string;
  categories: Category[];
  theme: Theme;
  start: string;
  busy: boolean;
  exporting: boolean;
  onClose: () => void;
  onSave: (
    theme: Theme,
    colors: { id: string; accent_color: string }[],
  ) => Promise<boolean>;
  onExport: () => Promise<void>;
  onLogout: () => Promise<void>;
}) {
  const [draftTheme, setDraftTheme] = useState<Theme>(theme === "dark" ? "dark" : "paper");
  const [colors, setColors] = useState(
    categories.map(({ id, accent_color }) => ({ id, accent_color })),
  );
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const disabled = busy || exporting;
  const changed =
    draftTheme !== theme ||
    colors.some(
      (color, i) => color.accent_color !== categories[i].accent_color,
    );
  return (
    <Modal
      title="Profil ve ayarlar"
      description={username}
      open
      busy={disabled}
      onClose={onClose}
    >
      <section className="profile-section">
        <h3>Görünüm</h3>
        <div className="theme-options" role="radiogroup" aria-label="Tema">
          {(
            [
              {
                value: "paper",
                label: "Açık",
                subtitle: "Krem zemin, ders renkleri",
              },
              {
                value: "dark",
                label: "Koyu",
                subtitle: "Koyu zemin, ders renkleri",
              },
            ] as const
          ).map((option) => (
            <label
              key={option.value}
              className={`theme-option ${draftTheme === option.value ? "chosen" : ""}`}
            >
              <input
                type="radio"
                name="profile-theme"
                value={option.value}
                checked={draftTheme === option.value}
                disabled={disabled}
                onChange={() => setDraftTheme(option.value)}
                className="sr-only"
              />
              <span
                className={`theme-sample ${option.value}`}
                aria-hidden="true"
              >
                <span />
                <span />
                <span />
              </span>
              <span className="theme-option-label">
                <strong>{option.label}</strong>
                <small>{option.subtitle}</small>
              </span>
              {draftTheme === option.value && (
                <Check size={16} aria-hidden="true" />
              )}
            </label>
          ))}
        </div>
      </section>
      <section className="profile-section">
        <h3>Ders renkleri</h3>
        <div className="profile-colors">
          {categories.map((category, index) => (
            <label className="profile-color" key={category.id}>
              <span>{category.name}</span>
              <input
                type="color"
                aria-label={`${category.name} rengi`}
                value={colors[index].accent_color}
                disabled={disabled}
                onChange={(event) =>
                  setColors((previous) =>
                    previous.map((color, i) =>
                      i === index
                        ? { ...color, accent_color: event.target.value }
                        : color,
                    ),
                  )
                }
              />
            </label>
          ))}
        </div>
      </section>
      <section className="profile-section profile-export">
        <div>
          <h3>Haftanın PDF’si</h3>
          <p>{weekLabel(start)}</p>
        </div>
        <button
          className="button secondary"
          disabled={disabled || changed}
          onClick={onExport}
        >
          {exporting ? (
            <LoaderCircle size={17} className="spinner" />
          ) : (
            <Download size={17} />
          )}
          {exporting ? "Hazırlanıyor" : "PDF indir"}
        </button>
        {changed && (
          <p className="profile-hint">
            PDF’yi yeni görünümle almak için önce ayarları kaydet.
          </p>
        )}
      </section>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="modal-actions profile-actions">
        <button className="text-button" disabled={disabled} onClick={onLogout}>
          <LogOut size={16} />
          Çıkış yap
        </button>
        <div className="action-spacer" />
        <button
          className="button secondary"
          disabled={disabled}
          onClick={onClose}
        >
          Kapat
        </button>
        <button
          className="button primary"
          disabled={disabled || !changed}
          onClick={async () => {
            setError("");
            if (await onSave(draftTheme, colors)) setSaved(true);
            else setError("Ayarlar kaydedilemedi. Tekrar dene.");
          }}
        >
          {busy ? (
            <LoaderCircle size={17} className="spinner" />
          ) : saved && !changed ? (
            "Kaydedildi"
          ) : (
            "Kaydet"
          )}
        </button>
      </div>
    </Modal>
  );
}
