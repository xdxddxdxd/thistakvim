import { NextResponse } from "next/server";
import { serverClient } from "@/lib/supabase/server";
import { addDays, weekStart } from "@/lib/dates";
import { validAnalysisDate, type AnalysisTask } from "@/lib/analysis";

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
  const rows: AnalysisTask[] = [];
  for (let from = 0; ; from += 1000) {
    let query = client.from("tasks").select("id,date,category_id,title,description,completed,position")
      .eq("user_id", user.id).is("deleted_at", null);
    if (scope === "week") query = query.gte("date", addDays(start, -7)).lte("date", addDays(start, 6));
    const result = await query.order("date").order("position").order("id").range(from, from + 999);
    if (result.error) return NextResponse.json({ error: "Analiz yüklenemedi. Tekrar dene." }, { status: 500 });
    rows.push(...result.data as AnalysisTask[]);
    if (result.data.length < 1000) break;
  }
  return NextResponse.json({
    tasks: scope === "all" ? rows : rows.filter((task) => task.date >= start),
    previous: scope === "all" ? [] : rows.filter((task) => task.date < start),
  }, { headers: { "Cache-Control": "private, no-store" } });
}
