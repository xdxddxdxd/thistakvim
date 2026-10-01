import { redirect } from "next/navigation";
import { serverClient } from "@/lib/supabase/server";
import Planner from "@/components/planner/Planner";
import { today } from "@/lib/dates";
import type { Category } from "@/lib/types";
import { validAnalysisDate } from "@/lib/analysis";
export const dynamic = "force-dynamic";
export default async function Home({ searchParams }: { searchParams: Promise<{ date?: string; task?: string }> }) {
  const params = await searchParams;
  const client = await serverClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) redirect("/login");
  const [categoryResult, profile] = await Promise.all([
    client.from("categories").select("*").order("position"),
    client.from("profiles").select("username,theme").eq("id", user.id).single(),
  ]);
  const { data, error } = categoryResult;
  if (error || !data?.length || profile.error)
    throw new Error(
      "Dersler yüklenemedi. Bağlantını kontrol edip tekrar dene.",
    );
  const initialNow = Date.now();
  return (
    <Planner
      key={`${params.date ?? ""}:${params.task ?? ""}`}
      userId={user.id}
      categories={data as Category[]}
      initialToday={today(new Date(initialNow))}
      initialNow={initialNow}
      username={profile.data.username}
      initialTheme={profile.data.theme}
      initialDate={validAnalysisDate(params.date) ? params.date : undefined}
      initialTask={typeof params.task === "string" && /^[0-9a-f-]{36}$/i.test(params.task) ? params.task : undefined}
    />
  );
}
