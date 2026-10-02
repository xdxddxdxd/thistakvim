import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { addDays, today, tytDaysRemaining, weekStart } from "../../lib/dates";
import type { Task } from "../../lib/types";

// Only authentication/export reads reach the server. All planner requests and
// mutations use browser-local fixtures so this test cannot alter saved plans.
test("clean forms and explicit cross-day drag choices", async ({ page }) => {
  test.setTimeout(120000);
  const account = JSON.parse(
    await readFile(".credentials/account.json", "utf8"),
  );
  const monday = addDays(weekStart(today()), 7);
  const tuesday = addDays(monday, 1),
    wednesday = addDays(monday, 2);
  const thursday = addDays(monday, 3),
    sunday = addDays(monday, 6);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const makeTask = (title: string, date: string, position: number): Task => ({
    id: randomUUID(),
    user_id: account.userId,
    date,
    category_id: "",
    title,
    description: "",
    note: "",
    completed: false,
    position,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    deleted_at: null,
  });
  const original = makeTask("Kopyalanacak görev", monday, 1024);
  original.completed = true;
  const movable = makeTask("Taşınacak görev", monday, 2048);
  const tasks = [
    original,
    movable,
    ...Array.from({ length: 16 }, (_, index) =>
      makeTask(
        `Uzun listedeki görev ${index + 1}`,
        thursday,
        (index + 1) * 1024,
      ),
    ),
  ];
  const mutations: { action: string; data: Record<string, unknown> }[] = [];
  await page.route("**/api/planner**", async (route) => {
    const request = route.request();
    if (request.method() === "GET") {
      const start = new URL(request.url()).searchParams.get("start")!;
      await route.fulfill({
        json: {
          tasks: tasks
            .filter(
              (task) => task.date >= start && task.date <= addDays(start, 6),
            )
            .sort((a, b) => a.position - b.position),
          notes: [],
          statuses: [
            {
              id: randomUUID(),
              user_id: account.userId,
              date: sunday,
              is_finished: true,
              finished_at: new Date().toISOString(),
            },
          ],
        },
      });
      return;
    }
    const body = request.postDataJSON();
    mutations.push(body);
    const task = tasks.find((task) => task.id === body.data.id)!;
    const sourceDate = task.date;
    if (body.action === "copy") {
      tasks.push({
        ...task,
        id: randomUUID(),
        date: body.data.dates[0],
        completed: false,
      });
    } else if (body.action === "move") {
      task.date = body.data.date;
      const siblings = tasks
        .filter((other) => other.id !== task.id && other.date === task.date)
        .sort((a, b) => a.position - b.position);
      const index = siblings.findIndex(
        (other) => other.id === body.data.before_id,
      );
      siblings.splice(index < 0 ? siblings.length : index, 0, task);
      siblings.forEach((other, i) => {
        other.position = (i + 1) * 1024;
      });
    } else {
      await route.fulfill({
        status: 400,
        json: { error: "Unexpected test action" },
      });
      return;
    }
    task.updated_at = new Date().toISOString();
    const dates = [...new Set<string>([sourceDate, ...(body.action === "copy" ? body.data.dates : [body.data.date])])];
    await route.fulfill({ json: { dates, tasks: tasks.filter((row) => dates.includes(row.date)) } });
  });
  await page.goto("/login");
  await page
    .getByLabel("Kullanıcı adı", { exact: true })
    .fill(account.username);
  await page.getByLabel("Şifre", { exact: true }).fill(account.password);
  await page.getByRole("button", { name: "Giriş yap", exact: true }).click();
  await expect(page).toHaveURL("http://localhost:3000/");
  const categories = await page.evaluate(
    async () => (await (await fetch("/api/preferences")).json()).categories,
  );
  tasks.forEach((task) => {
    task.category_id = categories[0].id;
  });
  await page
    .getByRole("button", { name: "Sonraki hafta", exact: true })
    .click();
  await expect(page.locator(".day-detail")).toHaveAttribute(
    "aria-busy",
    "false",
  );
  await page.locator(`[data-date="${monday}"] .day-select`).click();
  await expect(page.locator(".task-row")).toHaveCount(2);
  await expect(page.locator(".exam-countdown")).toHaveText(`2027 YKS’ye ${tytDaysRemaining(today())} gün kaldı`);
  await expect(page.locator(".exam-countdown")).toHaveAttribute("title", "2027 YKS · 19 Haziran 2027");
  await page.screenshot({ path: ".impeccable/review/tablet-planner-light.png" });
  await expect(page.locator(".planner-footer")).toHaveCount(0);

  await page.locator(".add-task").click();
  const dialog = page.getByRole("dialog");
  for (const label of ["Başlık", "Açıklama", "Not (isteğe bağlı)"])
    expect(
      await dialog
        .getByLabel(label, { exact: true })
        .getAttribute("placeholder"),
    ).toBeNull();
  await dialog.getByRole("button", { name: "İptal", exact: true }).click();
  await page.locator(`[data-task-id="${original.id}"] .task-menu`).click();
  await page
    .getByRole("menuitem", { name: "Günlere kopyala", exact: true })
    .click();
  const disabledDay = dialog.locator(".selection-row.unavailable");
  await expect(disabledDay).toHaveCount(1);
  await expect(disabledDay.locator("input")).toBeDisabled();
  await expect(disabledDay).toHaveCSS("opacity", "0.5");
  await expect(dialog.getByText("Kapalı", { exact: true })).toHaveCount(0);
  await dialog.getByRole("button", { name: "İptal", exact: true }).click();

  const longList = page.locator(`[data-date="${thursday}"] .day-tasks`);
  await expect(longList).toHaveCSS("scrollbar-width", "none");
  await expect(longList.locator(".day-task")).toHaveCount(3);
  await expect(longList.locator(".day-more")).toHaveText("+13");
  await page.locator(`[data-date="${thursday}"] .day-select`).click();
  await expect(page.locator(".task-row")).toHaveCount(16);
  await page.locator(`[data-date="${monday}"] .day-select`).click();

  await drag(
    page,
    `[data-task-id="${original.id}"] .drag-handle`,
    `[data-task-id="${movable.id}"]`,
  );
  await expect(page.locator(".drag-overlay")).toHaveCount(0);
  await expect(page.locator(".day-detail")).toHaveAttribute(
    "aria-busy",
    "false",
  );
  await expect(page.locator(".task-row").last()).toContainText(original.title);
  await expect(dialog).not.toBeVisible();
  expect(mutations).toHaveLength(1);

  await drag(
    page,
    `[data-task-id="${movable.id}"] .drag-handle`,
    `[data-date="${tuesday}"]`,
  );
  await expect(dialog).toHaveAccessibleName("Kopyala veya taşı");
  expect(mutations).toHaveLength(1);
  await expect(page.locator(`[data-date="${tuesday}"] .day-task`)).toHaveCount(
    0,
  );
  await dialog.getByRole("button", { name: "İptal", exact: true }).click();
  expect(movable.date).toBe(monday);
  expect(mutations).toHaveLength(1);

  await drag(
    page,
    `[data-task-id="${original.id}"] .drag-handle`,
    `[data-date="${tuesday}"]`,
  );
  await expect(dialog).toBeVisible();
  await expect(page.locator(".drag-overlay")).toHaveCount(0);
  await page.screenshot({ path: ".impeccable/review/drop-choice.png" });
  await dialog.getByRole("button", { name: "Kopyala", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.locator(`[data-date="${tuesday}"] .day-task`)).toHaveCount(
    1,
  );
  expect(original.date).toBe(monday);
  expect(original.completed).toBe(true);
  expect(tasks.find((task) => task.date === tuesday)!.completed).toBe(false);
  expect(mutations.at(-1)!.action).toBe("copy");

  await drag(
    page,
    `[data-task-id="${movable.id}"] .drag-handle`,
    `[data-date="${wednesday}"]`,
  );
  await dialog.getByRole("button", { name: "Taşı", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.locator(".task-row")).toHaveCount(1);
  expect(movable.date).toBe(wednesday);
  expect(mutations.at(-1)!.action).toBe("move");

  // The touch sensor must also wait for the same choice before writing.
  await page.locator(`[data-date="${wednesday}"] .day-select`).click();
  const from = (await page
    .locator(`[data-task-id="${movable.id}"] .drag-handle`)
    .boundingBox())!;
  const to = (await page.locator(`[data-date="${tuesday}"]`).boundingBox())!;
  const cdp = await page.context().newCDPSession(page);
  const x = from.x + from.width / 2,
    y = from.y + from.height / 2;
  const tx = to.x + to.width / 2,
    ty = to.y + to.height / 2;
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x, y }],
  });
  await page.waitForTimeout(260);
  for (let i = 1; i <= 12; i++)
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: x + ((tx - x) * i) / 12, y: y + ((ty - y) * i) / 12 }],
    });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await expect(dialog).toBeVisible();
  expect(mutations).toHaveLength(3);
  await page.setViewportSize({ width: 390, height: 844 });
  const box = (await dialog.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(390);
  await expect(
    dialog.getByRole("button", { name: "Taşı", exact: true }),
  ).toBeInViewport();
  await page.screenshot({ path: ".impeccable/review/mobile-drop-choice.png" });
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  expect(movable.date).toBe(wednesday);
  expect(mutations).toHaveLength(3);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page
    .getByRole("button", { name: "Profil ve ayarlar", exact: true })
    .click();
  await expect(dialog).toHaveAccessibleName("Profil ve ayarlar");
  await expect(dialog.getByRole("radio")).toHaveCount(2);
  await expect(dialog.locator('input[type="color"]')).toHaveCount(7);
  await expect(dialog.getByText(/CSV|JSON/)).toHaveCount(0);
  await expect(
    dialog.getByRole("button", { name: "PDF indir", exact: true }),
  ).toBeEnabled();
  await page.screenshot({ path: ".impeccable/review/tablet-profile.png" });
  let attempts = 0;
  await page.route("**/api/preferences", async (route) => {
    if (route.request().method() !== "POST") {
      await route.continue();
      return;
    }
    attempts++;
    if (attempts === 1) {
      await route.fulfill({
        status: 503,
        json: { error: "Test connection failure" },
      });
      return;
    }
    const preferences = route.request().postDataJSON();
    await route.fulfill({
      json: {
        theme: preferences.theme,
        categories: categories.map((category: { id: string }) => ({
          ...category,
          accent_color: preferences.colors.find(
            (color: { id: string }) => color.id === category.id,
          ).accent_color,
        })),
      },
    });
  });
  await dialog.getByText("Koyu", { exact: true }).click();
  await dialog.getByRole("radio", { name: /^Koyu/ }).focus();
  await page.keyboard.press("ArrowLeft");
  await expect(dialog.getByRole("radio", { name: /^Açık/ })).toBeChecked();
  await page.keyboard.press("ArrowRight");
  await expect(
    dialog.getByRole("radio", { name: /^Koyu/ }),
  ).toBeChecked();
  const color = dialog.locator('input[type="color"]').first();
  await color.evaluate((input: HTMLInputElement) => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!.call(input, "#b64b4b");
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await dialog.getByRole("button", { name: "Kaydet", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText("Tekrar dene");
  await expect(
    dialog.getByRole("radio", { name: /^Koyu/ }),
  ).toBeChecked();
  await dialog.getByRole("button", { name: "Kaydet", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute(
    "data-theme",
    "dark",
  );
  await expect(color).toHaveValue("#b64b4b");
  await expect(
    dialog.getByRole("button", { name: "Kaydedildi", exact: true }),
  ).toBeDisabled();
  await expect(page.locator(".planner-shell")).toHaveCSS(
    "background-color",
    "rgb(34, 37, 43)",
  );
  await page.screenshot({ path: ".impeccable/review/tablet-profile-dark.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: ".impeccable/review/mobile-profile.png" });
  const dialogBox = (await dialog.boundingBox())!;
  expect(dialogBox.x).toBeGreaterThanOrEqual(0);
  expect(dialogBox.x + dialogBox.width).toBeLessThanOrEqual(390);
  const downloadPromise = page.waitForEvent("download");
  await dialog.getByRole("button", { name: "PDF indir", exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe(`haftalik-plan-${monday}.pdf`);
  await download.saveAs("test-results/downloaded-week.pdf");
  expect(
    (await readFile("test-results/downloaded-week.pdf"))
      .subarray(0, 5)
      .toString(),
  ).toBe("%PDF-");
  expect(attempts).toBe(2);
  // Settings POSTs were intercepted, and planner mutation count stays fixed.
  expect(mutations).toHaveLength(3);
  for (const query of [
    "",
    "?format=csv",
    "?format=json",
    "?start=2026-02-30",
    `?start=${tuesday}`,
  ]) {
    const response = await page.request.get(`/api/export${query}`);
    expect(response.status()).toBe(400);
  }
  await dialog.getByRole("button", { name: "Kapat", exact: true }).click();
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.screenshot({ path: ".impeccable/review/tablet-planner-dark.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator(`[data-date="${thursday}"] .day-select`).click();
  await expect(
    page.locator(`[data-date="${thursday}"] .day-more`),
  ).toBeInViewport();
  await page.screenshot({ path: ".impeccable/review/mobile-task-count.png" });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

async function drag(page: Page, source: string, destination: string) {
  await expect(page.locator(source)).toBeEnabled();
  await page.waitForTimeout(300);
  const from = (await page.locator(source).boundingBox())!;
  const to = (await page.locator(destination).boundingBox())!;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    from.x + from.width / 2 + 10,
    from.y + from.height / 2,
    { steps: 4 },
  );
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, {
    steps: 20,
  });
  await page.mouse.up();
}
