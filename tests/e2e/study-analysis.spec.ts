import { test, expect, type Page } from "@playwright/test";
import { mkdir, readFile } from "node:fs/promises";
import type { AnalysisData } from "../../lib/analysis";

const start = "2026-09-28";
const studyTimes = [
  { date: "2026-09-28", minutes: 120 },
  { date: "2026-09-29", minutes: 0 },
  { date: "2026-09-30", minutes: 90 },
  // Even an unexpected future record must not be shown as completed study time.
  { date: "2026-10-03", minutes: 600 },
];
const previousStudyTimes = [{ date: "2026-09-21", minutes: 90 }];

test("study analysis distinguishes missing and zero records across weekly, general and empty views", async ({ page }) => {
  test.setTimeout(120000);
  const account = JSON.parse(await readFile(".credentials/account.json", "utf8"));
  const errors: string[] = [];
  const mutations: string[] = [];
  let empty = false;
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    if (request.method() !== "GET" && request.url().includes("/api/") && !request.url().includes("/api/auth/login")) mutations.push(request.url());
  });
  await page.route("**/api/analysis?**", async (route) => {
    expect(route.request().method()).toBe("GET");
    const scope = new URL(route.request().url()).searchParams.get("scope");
    const data: AnalysisData = {
      tasks: [], previous: [], asOf: "2026-10-02", closedThrough: "2026-10-01", chartStudyTimes: [], chartMonth: "2026-10-01", chartMonthEnd: "2026-10-31",
      studyTimes: empty ? [] : scope === "all" ? [...previousStudyTimes, ...studyTimes] : studyTimes,
      previousStudyTimes: empty || scope === "all" ? [] : previousStudyTimes,
    };
    await route.fulfill({ json: data });
  });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/login");
  await page.getByLabel("Kullanıcı adı", { exact: true }).fill(account.username);
  await page.getByLabel("Şifre", { exact: true }).fill(account.password);
  await page.getByRole("button", { name: "Giriş yap", exact: true }).click();
  await expect(page).toHaveURL("http://localhost:3000/");
  await page.goto(`/analiz?start=${start}&scope=week`);

  const study = page.getByRole("region", { name: "Çalışma süresi", exact: true });
  await expect(study).toBeVisible();
  await expect(study.locator("strong").first()).toHaveText("3 sa 30 dk");
  await expect(study.getByText("3 günün süresi kaydedildi", { exact: true })).toBeVisible();
  await expect(study.getByText("1 sa 30 dk", { exact: true })).toHaveCount(1);
  const tuesday = study.getByRole("row").filter({ hasText: "Salı" });
  const thursday = study.getByRole("row").filter({ hasText: "Perşembe" });
  const saturday = study.getByRole("row").filter({ hasText: "Cumartesi" });
  await expect(tuesday.getByText("0 sa 0 dk", { exact: true })).toBeVisible();
  await expect(tuesday).not.toContainText("Kaydedilmedi");
  await expect(thursday).toContainText("Kaydedilmedi");
  await expect(saturday).toContainText("Henüz gelmedi");
  await expect(study.getByText("10 sa 0 dk", { exact: true })).toHaveCount(0);

  await mkdir(".impeccable/review", { recursive: true });
  // Change only the DOM theme for CSS QA; no preference writes reach Supabase.
  for (const theme of ["paper", "dark"] as const) {
    await page.evaluate((value) => { document.documentElement.dataset.theme = value; }, theme);
    for (const [device, viewport] of [
      ["tablet", { width: 1280, height: 800 }],
      ["mobile", { width: 390, height: 844 }],
    ] as const) {
      await page.setViewportSize(viewport);
      await expect(study.locator("strong").first()).toHaveText("3 sa 30 dk");
      await assertNoHorizontalOverflow(page);
      await page.screenshot({ path: `.impeccable/review/analysis-${theme === "paper" ? "light" : "dark"}-${device}.png`, fullPage: true });
    }
  }

  await page.getByRole("button", { name: "Genel", exact: true }).click();
  await expect(study.locator("strong").first()).toHaveText("5 sa 0 dk");
  await expect(study.getByText("4 günün süresi kaydedildi", { exact: true })).toBeVisible();
  await expect(study.getByRole("columnheader", { name: "Kayıtlı gün", exact: true })).toBeVisible();
  const monday = study.getByRole("row").filter({ hasText: "Pazartesi" });
  await expect(monday.getByRole("cell").first()).toHaveText("1 sa 45 dk");
  await expect(monday.getByRole("cell").last()).toHaveText("2");
  await expect(tuesday.getByRole("cell").first()).toHaveText("0 sa 0 dk");
  await expect(tuesday.getByRole("cell").last()).toHaveText("1");
  await expect(study.getByText(/Önceki hafta/)).toHaveCount(0);
  await expect(study.getByText(/ortalaması yalnız süre kaydı olan tarihlerden/)).toBeVisible();
  await expect(monday.getByText("28 Eyl", { exact: true })).toHaveCount(0);
  await assertNoHorizontalOverflow(page);

  empty = true;
  await page.getByRole("button", { name: "Haftalık", exact: true }).click();
  await expect(study.locator("strong").first()).toHaveText("—");
  await expect(study.getByText("Henüz süre kaydı yok", { exact: true })).toBeVisible();
  await expect(study.getByText("Kaydedilmedi", { exact: true })).toHaveCount(5);
  await expect(study.getByText("Henüz gelmedi", { exact: true })).toHaveCount(2);
  await expect(study.getByText("0 sa 0 dk", { exact: true })).toHaveCount(0);
  await assertNoHorizontalOverflow(page);
  await page.getByRole("button", { name: "Genel", exact: true }).click();
  await expect(study.locator("strong").first()).toHaveText("—");
  await expect(study.getByText("Kayıt yok", { exact: true })).toHaveCount(7);
  await expect(study.getByText(/Önceki hafta/)).toHaveCount(0);
  await assertNoHorizontalOverflow(page);
  expect(mutations).toEqual([]);
  expect(errors).toEqual([]);
});

async function assertNoHorizontalOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}
