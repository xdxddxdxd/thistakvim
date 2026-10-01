import { NextResponse } from "next/server";
import { serverClient } from "@/lib/supabase/server";
import { isSameOrigin } from "@/lib/request";
export const dynamic = "force-dynamic";

export async function GET() {
  const client = await serverClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Yeniden giriş yap." }, { status: 401 });
  const [profile, categories] = await Promise.all([
    client.from("profiles").select("username,theme").eq("id", user.id).single(),
    client.from("categories").select("*").order("position"),
  ]);
  if (profile.error || categories.error)
    return NextResponse.json(
      { error: "Ayarlar yüklenemedi. Tekrar dene." },
      { status: 500 },
    );
  return NextResponse.json(
    { ...profile.data, categories: categories.data },
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
    !["paper", "monochrome"].includes(body.theme) ||
    !Array.isArray(body.colors) ||
    body.colors.length > 100 ||
    body.colors.some(
      (c: { id?: unknown; accent_color?: unknown }) =>
        !c ||
        typeof c.id !== "string" ||
        !/^[0-9a-f-]{36}$/i.test(c.id) ||
        typeof c.accent_color !== "string" ||
        !/^#[0-9a-f]{6}$/i.test(c.accent_color),
    )
  )
    return NextResponse.json(
      { error: "Tema ve ders renklerini kontrol et." },
      { status: 400 },
    );
  const { data, error } = await client.rpc("save_planner_preferences", {
    p_theme: body.theme,
    p_colors: body.colors,
  });
  if (error)
    return NextResponse.json(
      { error: "Ayarlar kaydedilemedi. Tekrar dene." },
      { status: 400 },
    );
  return NextResponse.json(data, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
