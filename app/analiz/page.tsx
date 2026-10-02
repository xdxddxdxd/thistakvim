import { redirect } from "next/navigation";
import { serverClient } from "@/lib/supabase/server";
import { today } from "@/lib/dates";
import { analysisStart } from "@/lib/analysis";
import type { Category } from "@/lib/types";
import Analysis from "@/components/analysis/Analysis";
import { analysisLocation } from "@/lib/analysis-location";

export const dynamic = "force-dynamic";
export const metadata = { title: "Analiz · Haftalık Plan" };
export default async function AnalysisPage({ searchParams }: { searchParams: Promise<{ start?: string; scope?: string; section?: string }> }) {
  const client = await serverClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) redirect("/login");
  const [categories, profile, params] = await Promise.all([
    client.from("categories").select("*").order("position"),
    client.from("profiles").select("theme").eq("id", user.id).single(),
    searchParams,
  ]);
  if (categories.error || profile.error) throw new Error("Analiz yüklenemedi. Tekrar dene.");
  return <Analysis key={JSON.stringify(params)} categories={categories.data as Category[]} theme={profile.data.theme === "dark" ? "dark" : "paper"} initialStart={analysisStart(params.start, today())} currentStart={analysisStart(null, today())} initialLocation={analysisLocation(params)} />;
}
