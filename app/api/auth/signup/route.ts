import { authResponse, isNativeAuthForm, readAuthInput } from "@/lib/auth-request";
import { maxAccountName, maxPassword, minSignupPassword, normalizedEmail, signupErrors, type SignupError } from "@/lib/login";
import { isSameOrigin } from "@/lib/request";
import { serverClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const native = isNativeAuthForm(request);
  const failed = (error: SignupError, status: number) => authResponse(
    native, `/login?kayit=1&kayitHata=${error}#giris`, { error: signupErrors[error] }, status,
  );
  if (!isSameOrigin(request)) return failed("request", 403);

  const body = await readAuthInput(request, native);
  const name = typeof body?.name === "string" ? body.name.trim().replace(/\s+/gu, " ") : "";
  const email = typeof body?.email === "string" ? normalizedEmail(body.email) : null;
  if (!name || name.length > maxAccountName || !email) return failed("invalid", 400);
  if (typeof body?.password !== "string" || body.password.length < minSignupPassword ||
      body.password.length > maxPassword) return failed("password", 400);

  const client = await serverClient();
  const { data, error } = await client.auth.signUp({
    email,
    password: body.password,
    options: {
      data: { display_name: name },
      emailRedirectTo: new URL("/api/auth/confirm", request.url).href,
    },
  });

  if (error?.status === 429) return failed("rate", 429);
  if (error?.code === "weak_password") return failed("weak", 400);
  if (error?.code === "email_address_invalid") return failed("invalid", 400);
  if (error && error.code !== "user_already_exists" && error.code !== "email_exists") {
    return failed("unavailable", 503);
  }

  if (data.session) return authResponse(native, "/", { ok: true }, 200);
  return authResponse(native, "/login?kayit=bekliyor#giris", { ok: true, checkEmail: true }, 200);
}
