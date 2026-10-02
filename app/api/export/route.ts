import { NextResponse } from "next/server";
import { serverClient } from "@/lib/supabase/server";
import { addDays, weekStart } from "@/lib/dates";
import { createWeekPdf, WeekPdfDensityError } from "@/lib/week-pdf";
import type { Task } from "@/lib/types";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const client = await serverClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Yeniden giriş yap." }, { status: 401 });
  const params = new URL(request.url).searchParams,
    start = params.get("start");
  if (
    params.has("format") ||
    !start ||
    !/^\d{4}-\d{2}-\d{2}$/.test(start) ||
    isNaN(Date.parse(`${start}T12:00:00Z`)) ||
    new Date(`${start}T12:00:00Z`).toISOString().slice(0, 10) !== start ||
    weekStart(start) !== start
  )
    return NextResponse.json(
      { error: "PDF için bir hafta seç." },
      { status: 400 },
    );
  const end = addDays(start, 6);
  try {
    async function readTasks() {
      const rows: Task[] = [];
      for (let from = 0; ; from += 1000) {
        const result = await client
          .from("tasks")
          .select("*")
          .gte("date", start!)
          .lte("date", end)
          .is("deleted_at", null)
          .order("position")
          .order("id")
          .range(from, from + 999);
        if (result.error) throw result.error;
        rows.push(...result.data);
        if (result.data.length < 1000) return rows;
      }
    }
    const [tasks, categories, profile] = await Promise.all([
      readTasks(),
      client.from("categories").select("*").order("position"),
      client.from("profiles").select("theme").eq("id", user.id).single(),
    ]);
    if (categories.error || profile.error)
      throw new Error("Read failed");
    const pdf = await createWeekPdf(
      start,
      { tasks, notes: [], statuses: [] },
      categories.data,
      profile.data.theme,
    );
    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="haftalik-plan-${start}.pdf"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (error instanceof WeekPdfDensityError)
      return NextResponse.json({ error: error.message }, { status: 422 });
    return NextResponse.json(
      { error: "Haftanın PDF’si hazırlanamadı. Tekrar dene." },
      { status: 500 },
    );
  }
}
