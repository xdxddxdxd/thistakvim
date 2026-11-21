import { NextResponse } from "next/server";
import { serverClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const tokenHash = params.get("token_hash");
  const code = params.get("code");
  const type = params.get("type");
  const reply = (success: boolean) => new NextResponse(null, {
    status: 303,
    headers: {
      Location: success ? "/" : "/login?error=confirmation#giris",
      "Cache-Control": "private, no-store",
      "Referrer-Policy": "no-referrer",
    },
  });

  if (tokenHash && (type === "email" || type === "signup")) {
    const client = await serverClient();
    const { error } = await client.auth.verifyOtp({ token_hash: tokenHash, type });
    return reply(!error);
  }
  if (code) {
    const client = await serverClient();
    const { error } = await client.auth.exchangeCodeForSession(code);
    return reply(!error);
  }
  return reply(false);
}
