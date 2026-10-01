export type AnalysisFilter = { label: string; category?: string; day?: number; title?: string; status?: "remaining" | "completed" };
export type AnalysisLocation = { scope: "week" | "all"; section: "summary" | "courses" | "tasks"; filter: AnalysisFilter | null };
export function analysisLocation(params: Record<string, unknown>): AnalysisLocation {
  let filter: AnalysisFilter | null = null;
  try {
    const value = typeof params.filter === "string" && params.filter.length <= 2000 ? JSON.parse(params.filter) : null;
    if (value && typeof value.label === "string" && value.label.length <= 200 &&
      (value.category === undefined || (typeof value.category === "string" && /^[0-9a-f-]{36}$/i.test(value.category))) &&
      (value.day === undefined || (Number.isInteger(value.day) && value.day >= 0 && value.day <= 6)) &&
      (value.title === undefined || (typeof value.title === "string" && value.title.length <= 120)) &&
      (value.status === undefined || value.status === "remaining" || value.status === "completed")) {
      filter = { label: value.label, category: value.category, day: value.day, title: value.title, status: value.status };
    }
  } catch { /* Ignore malformed links. */ }
  return { scope: params.scope === "all" ? "all" : "week", section: params.section === "courses" || params.section === "tasks" ? params.section : "summary", filter };
}
export function analysisUrl(start: string, location: AnalysisLocation): string {
  const params = new URLSearchParams({ start, scope: location.scope, section: location.section });
  if (location.filter) params.set("filter", JSON.stringify(location.filter));
  return `/analiz?${params}`;
}
