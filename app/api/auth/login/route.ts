import { NextResponse } from "next/server";
import { serverClient } from "@/lib/supabase/server";
import { isSameOrigin } from "@/lib/request";
export async function POST(request: Request) {
  if (!isSameOrigin(request))
    return NextResponse.json({ error: "Geçersiz istek." }, { status: 403 });
  const body = await request.json().catch(() => null);
  if (
    !body ||
    typeof body.username !== "string" ||
    typeof body.password !== "string" ||
    body.password.length > 256
  )
    return NextResponse.json(
      { error: "Kullanıcı adı ve şifreni gir." },
      { status: 400 },
    );
  const client = await serverClient();
  const validName =
    body.username.trim().toLocaleLowerCase("tr-TR") ===
    process.env.PLANNER_USERNAME?.toLocaleLowerCase("tr-TR");
  const { error } = await client.auth.signInWithPassword({
    email: process.env.PLANNER_AUTH_EMAIL!,
    password: validName ? body.password : crypto.randomUUID(),
  });
  if (error)
    return NextResponse.json(
      {
        error:
          error.status === 429
            ? "Çok fazla deneme yaptın. Biraz bekleyip tekrar dene."
            : "Kullanıcı adı veya şifre yanlış.",
      },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  return NextResponse.json(
    { ok: true },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
