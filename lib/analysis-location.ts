export type AnalysisLocation = { scope: "week" | "all"; section: "summary" | "courses" };
export function analysisLocation(params: Record<string, unknown>): AnalysisLocation {
  return { scope: params.scope === "all" ? "all" : "week", section: params.section === "courses" ? "courses" : "summary" };
}
export function analysisUrl(start: string, location: AnalysisLocation): string {
  const params = new URLSearchParams({ start, scope: location.scope, section: location.section });
  return `/analiz?${params}`;
}
