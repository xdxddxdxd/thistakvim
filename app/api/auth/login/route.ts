import { authResponse, isNativeAuthForm, readAuthInput } from "@/lib/auth-request";
import { loginErrors, maxEmail, maxPassword, normalizedEmail, type LoginError } from "@/lib/login";
import { isSameOrigin } from "@/lib/request";
import { serverClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const native = isNativeAuthForm(request);
  const reply = (error: LoginError | null, status: number) => authResponse(
    native,
    error ? `/login?error=${error}#giris` : "/",
    error ? { error: loginErrors[error] } : { ok: true },
    status,
  );
  if (!isSameOrigin(request)) return reply("request", 403);

  const body = await readAuthInput(request, native);
  if (typeof body?.username !== "string" || typeof body.password !== "string" ||
      body.username.length > maxEmail || !body.password || body.password.length > maxPassword) {
    return reply("invalid", 400);
  }

  const identifier = body.username.trim();
  const legacyUser = process.env.PLANNER_USERNAME?.trim().toLocaleLowerCase("tr-TR");
  const email = legacyUser && identifier.toLocaleLowerCase("tr-TR") === legacyUser
    ? process.env.PLANNER_AUTH_EMAIL
    : normalizedEmail(identifier);
  if (!email) return reply("credentials", 401);

  const client = await serverClient();
  const { error } = await client.auth.signInWithPassword({ email, password: body.password });
  if (error?.status === 429) return reply("rate", 429);
  if (error?.code === "email_not_confirmed") return reply("unconfirmed", 403);
  return error ? reply("credentials", 401) : reply(null, 200);
}
