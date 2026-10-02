import { NextResponse } from "next/server";
import { serverClient } from "@/lib/supabase/server";
import { isSameOrigin } from "@/lib/request";
export const dynamic = "force-dynamic";
const validDate = (s: unknown): s is string =>
  typeof s === "string" &&
  /^\d{4}-\d{2}-\d{2}$/.test(s) &&
  !isNaN(Date.parse(`${s}T12:00:00Z`)) &&
  new Date(`${s}T12:00:00Z`).toISOString().slice(0, 10) === s;
export async function GET(request: Request) {
  const client = await serverClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Yeniden giriş yap." }, { status: 401 });
  const start = new URL(request.url).searchParams.get("start");
  if (!validDate(start))
    return NextResponse.json({ error: "Geçersiz tarih." }, { status: 400 });
  const { data, error } = await client.rpc("planner_week", { p_start: start });
  if (error)
    return NextResponse.json(
      { error: "Plan yüklenemedi. Tekrar dene." },
      { status: 500 },
    );
  return NextResponse.json(
    data,
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
export async function POST(request: Request) {
  if (!isSameOrigin(request))
    return NextResponse.json({ error: "Geçersiz istek." }, { status: 403 });
  const client = await serverClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Yeniden giriş yap." }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (
    !body ||
    ![
      "create",
      "edit",
      "toggle",
      "delete",
      "restore",
      "move",
      "copy",
      "note",
    ].includes(body.action) ||
    typeof body.data !== "object" ||
    !body.data
  )
    return NextResponse.json({ error: "Geçersiz işlem." }, { status: 400 });
  if (
    ["edit", "toggle", "delete", "move", "copy"].includes(body.action) &&
    (typeof body.data.updated_at !== "string" ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(body.data.updated_at) ||
      !Number.isFinite(Date.parse(body.data.updated_at)))
  )
    return NextResponse.json(
      { error: "Görev işlemi için güncel kayıt gerekli. Planı yenileyip tekrar dene." },
      { status: 400 },
    );
  if (body.action === "note" && (!validDate(body.data.date) || typeof body.data.content !== "string" || body.data.content.length > 500 || !Number.isSafeInteger(body.data.revision) || body.data.revision < 0))
    return NextResponse.json({ error: "Notu kaydetmek için güncel kayıt gerekli." }, { status: 400 });
  const { data, error } = body.action === "note"
    ? await client.rpc("save_day_note", { p_date: body.data.date, p_content: body.data.content, p_revision: body.data.revision })
    : await client.rpc("planner_mutate_with_tasks", { p_action: body.action, p_data: body.data });
  if (data?.locked) return NextResponse.json({ error: "Bu gün artık düzenlenemez. Notunu taslak olarak saklayabilirsin.", locked: true }, { status: 423 });
  if (data?.conflict) return NextResponse.json({ error: "Not başka bir cihazda değişti. Taslağını güncel notla karşılaştır.", current: data.current }, { status: 409 });
  if (error) {
    const allowed = [
      "Bu gün",
      "Hedef gün",
      "Yarın tamamlanmış",
      "Görev başka",
      "Görev işlemi",
      "Sıralama değişti",
      "Geri alma süresi",
      "En az bir",
    ];
    const message = allowed.some((prefix) => error.message.startsWith(prefix))
      ? error.message
      : "İşlem kaydedilemedi. Bilgileri kontrol edip tekrar dene.";
    return NextResponse.json({ error: message }, { status: 409 });
  }
  return NextResponse.json(data, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
