import { NextResponse } from "next/server";
import { serverClient } from "@/lib/supabase/server";
import { isSameOrigin } from "@/lib/request";
import { loginErrors, type LoginError } from "@/lib/login";
export async function POST(request: Request) {
  const nativeForm = request.headers.get("content-type")?.split(";", 1)[0].trim() === "application/x-www-form-urlencoded";
  const reply = (error: LoginError | null, status: number) => nativeForm
    ? new NextResponse(null, { status: 303, headers: {
        Location: error ? `/login?error=${error}#giris` : "/",
        "Cache-Control": "private, no-store",
      } })
    : NextResponse.json(error ? { error: loginErrors[error] } : { ok: true }, {
        status, headers: { "Cache-Control": "private, no-store" },
      });
  if (!isSameOrigin(request))
    return reply("request", 403);
  const body = nativeForm
    ? await request.formData().then((form) => ({ username: form.get("username"), password: form.get("password") })).catch(() => null)
    : await request.json().catch(() => null);
  if (
    !body ||
    typeof body.username !== "string" ||
    typeof body.password !== "string" ||
    body.password.length > 256
  )
    return reply("invalid", 400);
  const client = await serverClient();
  const validName =
    body.username.trim().toLocaleLowerCase("tr-TR") ===
    process.env.PLANNER_USERNAME?.toLocaleLowerCase("tr-TR");
  const { error } = await client.auth.signInWithPassword({
    email: process.env.PLANNER_AUTH_EMAIL!,
    password: validName ? body.password : crypto.randomUUID(),
  });
  if (error)
    return reply(error.status === 429 ? "rate" : "credentials", 401);
  return reply(null, 200);
}
