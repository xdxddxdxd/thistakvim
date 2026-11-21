import { NextResponse } from "next/server";
import { isSameOrigin } from "@/lib/request";
import { serverClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const headers = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" };
  if (!isSameOrigin(request)) return new NextResponse(null, { status: 403, headers });

  const client = await serverClient();
  const { data, error } = await client.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: new URL("/api/auth/confirm", request.url).href,
      skipBrowserRedirect: true,
    },
  });

  return new NextResponse(null, {
    status: 303,
    headers: { ...headers, Location: error || !data.url ? "/login?error=google#giris" : data.url },
  });
}
