"use client";

import { useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import { Clock3, LoaderCircle, RefreshCw } from "lucide-react";
import { studyMinutes, studyTimeLabel } from "@/lib/study-time";
import styles from "./StudyTime.module.css";

export type StudyTimeHandle = { canLeave: () => boolean };
export default function StudyTime({ date, editable, ref, onSaving, disabled = false }: {
  date: string; editable: boolean; ref?: Ref<StudyTimeHandle>; onSaving: (saving: boolean) => void; disabled?: boolean;
}) {
  const [hours, setHours] = useState("");
  const [minutes, setMinutes] = useState("");
  const [saved, setSaved] = useState<number | null>(null);
  const [revision, setRevision] = useState(0);
  const [conflict, setConflict] = useState<{ minutes: number | null; revision: number } | null>(null);
  const [allowed, setAllowed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [retry, setRetry] = useState(0);
  const pending = useRef(false);
  const total = studyMinutes(Number(hours || 0), Number(minutes || 0));
  const canEdit = editable && allowed;
  const dirty = (saved !== null || hours !== "" || minutes !== "") && (total === null || total !== saved);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setLoadError("");
    fetch("/api/study-time?date=" + date, { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        if (response.status === 401) { window.location.assign("/login"); return; }
        const result = await response.json();
        if (!response.ok) throw new Error(result.error);
        if (!controller.signal.aborted) { setSaved(result.minutes); setRevision(result.revision); setAllowed(result.can_record);
          setHours(result.minutes === null ? "" : String(Math.floor(result.minutes / 60)));
          setMinutes(result.minutes === null ? "" : String(result.minutes % 60)); }
      })
      .catch((error) => { if (!controller.signal.aborted) setLoadError(error instanceof Error ? error.message : "Çalışma süresi yüklenemedi."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [date, retry]);

  async function save(expectedRevision?: number) {
    if (pending.current || loading || loadError || !canEdit || (!dirty && expectedRevision === undefined) || (conflict && expectedRevision === undefined)) return;
    if (total === null) { setSaveError("Saat 0–24, dakika 0–59 olmalı. Toplam 24 saati geçemez."); return; }
    pending.current = true;
    setSaving(true); onSaving(true); setSaveError("");
    try {
      const response = await fetch("/api/study-time", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, hours: Number(hours || 0), minutes: Number(minutes || 0), revision: expectedRevision ?? revision }),
      });
      if (response.status === 401) { window.location.assign("/login"); return; }
      const result = await response.json();
      if (response.status === 409 && result.current) {
        setConflict(result.current);
        setSaveError(result.error);
        return;
      }
      if (response.status === 423) {
        setAllowed(false); setConflict(null);
        if (result.current) setSaved(result.current.minutes);
      }
      if (!response.ok) throw new Error(result.error);
      setSaved(result.minutes); setRevision(result.revision); setConflict(null);
      setHours(String(Math.floor(result.minutes / 60))); setMinutes(String(result.minutes % 60));
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Çalışma süresi kaydedilemedi. Tekrar dene.");
    } finally { pending.current = false; setSaving(false); onSaving(false); }
  }
  useImperativeHandle(ref, () => ({ canLeave: () => {
    if (pending.current) return false;
    if (!canEdit || (!dirty && !conflict)) return true;
    setSaveError("Ayrılmadan önce süreyi kaydet veya Vazgeç ile girişi temizle.");
    return false;
  } }));
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if ((dirty && canEdit) || pending.current) { event.preventDefault(); event.returnValue = ""; }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, canEdit]);

  const heading = <div className={styles.heading}><Clock3 size={18} /><h3>Çalışma süresi</h3><span>Günlük toplam</span></div>;
  if (!loading && !loadError && !canEdit) return <section className={styles.form} aria-label="Kaydedilen çalışma süresi">
    {heading}<p className={styles.recorded} aria-live="polite">{saved === null ? "Süre kaydedilmedi" : studyTimeLabel(saved)}</p>
    <p className={styles.caption}>Gün kapandı · Değiştirilemez</p>
    {dirty && <p className={styles.caption}>Kaydedilmemiş değişikliğin süreye dahil edilmedi.</p>}
    {saveError && <p className={styles.status} role="status">{saveError}</p>}
  </section>;
  return <form className={styles.form} aria-label="Çalışma süresi" aria-busy={loading || saving} onSubmit={(event) => { event.preventDefault(); void save(); }}>
    {heading}
    {!loading && !loadError && canEdit && <>
      <p className={styles.caption}>Günlük toplamını 23:59’a kadar güncelleyebilirsin.</p>
      <div className={styles.controls}>
        <label>Saat<input aria-label="Çalışılan saat" type="number" inputMode="numeric" min={0} max={24} step={1} value={hours} disabled={disabled || saving} onChange={(event) => { setHours(event.target.value); setSaveError(""); }} /></label>
        <span className={styles.separator} aria-hidden="true">:</span>
        <label>Dakika<input aria-label="Çalışılan dakika" type="number" inputMode="numeric" min={0} max={59} step={1} value={minutes} disabled={disabled || saving} onChange={(event) => { setMinutes(event.target.value); setSaveError(""); }} /></label>
        <button className={"button primary " + styles.save} type="submit" disabled={disabled || saving || !dirty || !!conflict}>
          {saving && <LoaderCircle size={16} className="spinner" />}{saving ? "Kaydediliyor" : "Kaydet"}
        </button>
      </div>
    </>}
    {dirty && <button className={"text-button " + styles.cancel} type="button" disabled={saving || disabled} onClick={() => { setHours(saved === null ? "" : String(Math.floor(saved / 60))); setMinutes(saved === null ? "" : String(saved % 60)); setSaveError(""); }}>Vazgeç</button>}
    {conflict && canEdit && <div className={styles.conflict}>
      <p>Güncel süre: {conflict.minutes === null ? "Henüz kaydedilmedi" : studyTimeLabel(conflict.minutes)}</p>
      <div>
        <button className="button secondary" type="button" disabled={saving || disabled} onClick={() => {
          setSaved(conflict.minutes); setRevision(conflict.revision);
          setHours(conflict.minutes === null ? "" : String(Math.floor(conflict.minutes / 60)));
          setMinutes(conflict.minutes === null ? "" : String(conflict.minutes % 60));
          setConflict(null); setSaveError("");
        }}>Güncel süreyi kullan</button>
        <button className="button primary" type="button" disabled={saving || disabled} onClick={() => void save(conflict.revision)}>Değerimi kaydet</button>
      </div>
    </div>}
    <div className={styles.status} aria-live="polite">
      {loading ? "Süre yükleniyor…" : loadError ? <><span role="alert">{loadError}</span><button className="text-button" type="button" onClick={() => setRetry((value) => value + 1)}><RefreshCw size={13} /> Tekrar dene</button></> : saveError ? <span role="alert">{saveError}</span> : !dirty && saved !== null ? "Kaydedildi · " + studyTimeLabel(saved) : null}
    </div>
  </form>;
}
