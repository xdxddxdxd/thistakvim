import { NextResponse } from "next/server";
import { serverClient } from "@/lib/supabase/server";
import { isSameOrigin } from "@/lib/request";
import { validAnalysisDate } from "@/lib/analysis";
import { canRecordStudyTime, studyMinutes } from "@/lib/study-time";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const client = await serverClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) return NextResponse.json({ error: "Yeniden giriş yap." }, { status: 401 });
  const date = new URL(request.url).searchParams.get("date");
  if (!validAnalysisDate(date)) return NextResponse.json({ error: "Geçersiz tarih." }, { status: 400 });
  const [time, status] = await Promise.all([
    client.from("day_study_time").select("date,minutes,revision").eq("user_id", user.id).eq("date", date).maybeSingle(),
    client.from("day_status").select("is_finished").eq("user_id", user.id).eq("date", date).maybeSingle(),
  ]);
  if (time.error || status.error) return NextResponse.json({ error: "Çalışma süresi yüklenemedi. Tekrar dene." }, { status: 500 });
  return NextResponse.json({ date, minutes: time.data?.minutes ?? null, revision: time.data?.revision ?? 0, can_record: canRecordStudyTime(date, status.data?.is_finished ?? false) }, { headers: { "Cache-Control": "private, no-store" } });
}
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Geçersiz istek." }, { status: 403 });
  const client = await serverClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) return NextResponse.json({ error: "Yeniden giriş yap." }, { status: 401 });
  const body = await request.json().catch(() => null);
  const minutes = studyMinutes(body?.hours, body?.minutes);
  if (!validAnalysisDate(body?.date) || minutes === null) return NextResponse.json({ error: "Saat 0–24, dakika 0–59 olmalı; günlük toplam 24 saati geçemez." }, { status: 400 });
  if (!Number.isSafeInteger(body.revision) || body.revision < 0) return NextResponse.json({ error: "Süreyi kaydetmek için güncel kayıt gerekli." }, { status: 400 });
  const { data, error } = await client.rpc("save_study_time", { p_date: body.date, p_minutes: minutes, p_revision: body.revision });
  if (data?.locked) return NextResponse.json({ error: "Süre yalnızca aynı gün içinde, 23:59'a kadar değiştirilebilir.", current: data.current }, { status: 423 });
  if (data?.conflict) return NextResponse.json({ error: "Süre başka bir cihazda değişti. Güncel süreyi incele.", current: data.current }, { status: 409 });
  if (error) {
    console.error("Study time RPC failed", { code: error.code, message: error.message });
    return NextResponse.json({ error: "Çalışma süresi kaydedilemedi. Tekrar dene." }, { status: 500 });
  }
  return NextResponse.json(data, { headers: { "Cache-Control": "private, no-store" } });
}
