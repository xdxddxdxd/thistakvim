import { NextResponse } from "next/server";
import { serverClient } from "@/lib/supabase/server";
import { addDays, today, weekStart } from "@/lib/dates";
import { validAnalysisDate, type AnalysisStudyTime, type AnalysisTask } from "@/lib/analysis";

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
  const asOf = today();
  const userId = user.id;
  const periodStart = addDays(start, -7);
  const periodEnd = addDays(start, 6);
  async function readTasks() {
    const rows: AnalysisTask[] = [];
    for (let from = 0; ; from += 1000) {
      let query = client.from("tasks").select("id,date,category_id,title,description,completed,position")
        .eq("user_id", userId).is("deleted_at", null);
      if (scope === "week") query = query.gte("date", periodStart).lte("date", periodEnd);
      const result = await query.order("date").order("position").order("id").range(from, from + 999);
      if (result.error) throw result.error;
      rows.push(...result.data as AnalysisTask[]);
      if (result.data.length < 1000) return rows;
    }
  }
  async function readStudyTimes() {
    const rows: AnalysisStudyTime[] = [];
    for (let from = 0; ; from += 1000) {
      let query = client.from("day_study_time").select("date,minutes").eq("user_id", userId)
        .lte("date", scope === "week" && periodEnd < asOf ? periodEnd : asOf);
      if (scope === "week") query = query.gte("date", periodStart);
      const result = await query.order("date").range(from, from + 999);
      if (result.error) throw result.error;
      rows.push(...result.data as AnalysisStudyTime[]);
      if (result.data.length < 1000) return rows;
    }
  }
  const result = await Promise.all([readTasks(), readStudyTimes()]).catch(() => null);
  if (!result) return NextResponse.json({ error: "Analiz yüklenemedi. Tekrar dene." }, { status: 500 });
  const [rows, studyTimes] = result;
  return NextResponse.json({
    tasks: scope === "all" ? rows : rows.filter((task) => task.date >= start),
    previous: scope === "all" ? [] : rows.filter((task) => task.date < start),
    studyTimes: scope === "all" ? studyTimes : studyTimes.filter((record) => record.date >= start),
    previousStudyTimes: scope === "all" ? [] : studyTimes.filter((record) => record.date < start),
    asOf,
  }, { headers: { "Cache-Control": "private, no-store" } });
}
