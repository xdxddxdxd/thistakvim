import { NextResponse } from "next/server";
import { serverClient } from "@/lib/supabase/server";
import { weekStart } from "@/lib/dates";
import { validAnalysisDate } from "@/lib/analysis";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const client = await serverClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) return NextResponse.json({ error: "Yeniden giriş yap." }, { status: 401 });
  const params = new URL(request.url).searchParams;
  const start = params.get("start");
  const scope = params.get("scope") ?? "week";
  if (!validAnalysisDate(start) || weekStart(start) !== start || !["week", "all"].includes(scope)) {
    return NextResponse.json({ error: "Geçersiz analiz aralığı." }, { status: 400 });
  }
  const { data, error } = await client.rpc("planner_analysis", { p_start: start, p_scope: scope });
  if (error) return NextResponse.json({ error: "Analiz yüklenemedi. Tekrar dene." }, { status: 500 });
  return NextResponse.json(data, { headers: { "Cache-Control": "private, no-store" } });
}
