import { NextResponse } from "next/server";
import { serverClient } from "@/lib/supabase/server";
import { isSameOrigin } from "@/lib/request";
export async function POST(request: Request) {
  if (!isSameOrigin(request))
    return NextResponse.json({ error: "Geçersiz istek." }, { status: 403 });
  const client = await serverClient();
  const { error } = await client.auth.signOut();
  return NextResponse.json(
    error ? { error: "Çıkış yapılamadı. Tekrar dene." } : { ok: true },
    { status: error ? 500 : 200 },
  );
}
