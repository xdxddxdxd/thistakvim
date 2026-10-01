import { test, expect, type Page } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import { addDays, today, weekStart } from "../../lib/dates";
type TaskRecord = {
  id: string;
  date: string;
  title: string;
  completed: boolean;
  updated_at: string;
  position: number;
};
const marker = `[test-${Date.now()}]`;
const monday = addDays(weekStart(today()), 7),
  tuesday = addDays(monday, 1),
  wednesday = addDays(monday, 2),
  friday = addDays(monday, 4);

test("complete tablet planner flow with real Supabase persistence", async ({
  page,
}) => {
  test.setTimeout(240000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const account = JSON.parse(
    await readFile(".credentials/account.json", "utf8"),
  );
  await writeFile(
    ".credentials/e2e-cleanup.json",
    JSON.stringify({ marker, monday }),
  );
  await page.goto("/login");
  await page
    .getByLabel("Kullanıcı adı", { exact: true })
    .fill(account.username);
  await page.getByLabel("Şifre", { exact: true }).fill(account.password);
  await page.getByRole("button", { name: "Giriş yap", exact: true }).click();
  await expect(page).toHaveURL("http://localhost:3000/");
  await expect(page.locator(".day-detail")).toHaveAttribute(
    "aria-busy",
    "false",
  );
  await expect(page.locator(".day-card")).toHaveCount(7);
  await page
    .getByRole("button", { name: "Sonraki hafta", exact: true })
    .click();
  await expect(page.locator(".day-detail")).toHaveAttribute(
    "aria-busy",
    "false",
  );
  await page.locator(`[data-date="${monday}"] .day-select`).click();
  async function add(title: string, category: string, description: string) {
    await page.locator(".add-task").click();
    const dialog = page.getByRole("dialog");
    await dialog
      .getByLabel("Ders / kategori")
      .selectOption({ label: category });
    await dialog.getByLabel("Başlık", { exact: true }).fill(title);
    await dialog.getByLabel("Açıklama", { exact: true }).fill(description);
    await dialog.getByRole("button", { name: "Kaydet", exact: true }).click();
    await expect(dialog).not.toBeVisible();
  }
  const a = `${marker} Problemler`,
    b = `${marker} Paragraf`,
    c = `${marker} Fizik tekrar`;
  await add(a, "Matematik", "40 soru çöz");
  await add(b, "Türkçe", "2 test + yanlış analizi");
  await add(c, "Fizik", "Elektrik konu özeti");
  await expect(page.locator(`[data-date="${monday}"] .day-task`)).toHaveCount(
    3,
  );
  const rowA = page.locator(".task-row").filter({ hasText: a });
  await rowA
    .getByRole("button", {
      name: `${a}: tamamlandı olarak işaretle`,
      exact: true,
    })
    .click();
  await expect(rowA.locator(".completion")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await rowA
    .getByRole("button", {
      name: `${a}: tamamlanmadı olarak işaretle`,
      exact: true,
    })
    .click();
  await expect(rowA.locator(".completion")).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  async function drag(source: string, destination: string) {
    await expect(page.locator(source)).toBeEnabled();
    await page.waitForTimeout(300);
    /* Wait for dnd-kit position transition before measuring the hit target. */ const from =
        await page.locator(source).boundingBox(),
      to = await page.locator(destination).boundingBox();
    expect(from && to).toBeTruthy();
    await page.mouse.move(
      from!.x + from!.width / 2,
      from!.y + from!.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(
      from!.x + from!.width / 2 + 10,
      from!.y + from!.height / 2,
      { steps: 4 },
    );
    await page.mouse.move(to!.x + to!.width / 2, to!.y + to!.height / 2, {
      steps: 20,
    });
    await page.mouse.up();
  }
  let tasks = (
    await (await page.request.get(`/api/planner?start=${monday}`)).json()
  ).tasks as TaskRecord[];
  const idA = tasks.find((t) => t.title === a)!.id,
    idB = tasks.find((t) => t.title === b)!.id,
    idC = tasks.find((t) => t.title === c)!.id;
  await drag(`[data-task-id="${idA}"] .drag-handle`, `[data-task-id="${idC}"]`);
  await expect(page.locator(".task-row").last()).toContainText(a);
  await drag(
    `[data-task-id="${idC}"] .drag-handle`,
    `[data-date="${tuesday}"]`,
  );
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Taşı", exact: true })
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(
    page.locator(`[data-date="${tuesday}"] .day-task`),
  ).toContainText(c);
  await expect(page.locator(".task-row")).toHaveCount(2);
  await page.locator(`[data-task-id="${idB}"] .task-menu`).click();
  await page
    .getByRole("menuitem", { name: "Günlere kopyala", exact: true })
    .click();
  let dialog = page.getByRole("dialog");
  await dialog.getByRole("checkbox", { name: /^Çarşamba / }).check();
  await dialog.getByRole("checkbox", { name: /^Cuma / }).check();
  await dialog.getByRole("button", { name: "Kopyala", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(
    page.locator(`[data-date="${wednesday}"] .day-task`),
  ).toContainText(b);
  await expect(page.locator(`[data-date="${friday}"] .day-task`)).toContainText(
    b,
  );
  await page
    .getByLabel("Günün notu", { exact: true })
    .fill(`${marker} Yarın zor sorulara tekrar bak.`);
  await expect(page.locator(".note-meta")).toContainText("Kaydedildi");
  await page.reload();
  await expect(page.locator(".day-detail")).toHaveAttribute(
    "aria-busy",
    "false",
  );
  await page
    .getByRole("button", { name: "Sonraki hafta", exact: true })
    .click();
  await expect(page.locator(".day-detail")).toHaveAttribute(
    "aria-busy",
    "false",
  );
  await page.locator(`[data-date="${monday}"] .day-select`).click();
  await expect(page.getByLabel("Günün notu", { exact: true })).toHaveValue(
    `${marker} Yarın zor sorulara tekrar bak.`,
  );
  await page.locator(`[data-task-id="${idB}"] .task-menu`).click();
  await page.getByRole("menuitem", { name: "Sil", exact: true }).click();
  await expect(page.locator(".task-row")).toHaveCount(1);
  await page.getByRole("button", { name: "Geri al", exact: true }).click();
  await expect(page.locator(".task-row")).toHaveCount(2);
  // Manual closure is removed from both UI and API.
  tasks = (await (await page.request.get(`/api/planner?start=${monday}`)).json()).tasks;
  const finalization = await page.request.post("/api/planner", {
    headers: { origin: "http://localhost:3000" },
    data: { action: "finish", data: { date: monday, mode: "selected", ids: tasks.filter((task) => task.date === monday && !task.completed && task.id !== idB).map((task) => task.id) } },
  });
  expect(finalization.status()).toBe(400);
  await page.goto(`/?date=${monday}`);
  await expect(page.locator(".day-detail")).toHaveAttribute("aria-busy", "false");
  await expect(page.getByRole("button", { name: "Günü bitir", exact: true })).toHaveCount(0);
  await expect(page.getByLabel("Günün notu", { exact: true })).toBeEditable();
  await expect(page.locator(".add-task")).toHaveCount(1);
  await expect(page.locator(`[data-date="${tuesday}"] .day-task`)).toHaveCount(
    1,
  );
  tasks = (
    await (await page.request.get(`/api/planner?start=${monday}`)).json()
  ).tasks;
  const staleEdit = await page.request.post("/api/planner", {
    headers: { origin: "http://localhost:3000" },
    data: {
      action: "toggle",
      data: {
        id: idB,
        updated_at: "2000-01-01T00:00:00Z",
      },
    },
  });
  expect(staleEdit.status()).toBe(409);
  const output = await page.request.get(`/api/export?start=${monday}`);
  expect(output.status()).toBe(200);
  expect(output.headers()["content-type"]).toBe("application/pdf");
  const csv = await page.request.get("/api/export?format=csv");
  expect(csv.status()).toBe(400);
  await page.locator(`[data-date="${tuesday}"] .day-select`).click();
  await expect(page.locator(".task-row")).toHaveCount(1);
  // Real touch sensor activation and carry to a day card on tablet.
  await expect(
    page.locator(`[data-task-id="${idC}"] .drag-handle`),
  ).toBeEnabled();
  const touchFrom = await page
      .locator(`[data-task-id="${idC}"] .drag-handle`)
      .boundingBox(),
    touchTo = await page.locator(`[data-date="${wednesday}"]`).boundingBox();
  const cdp = await page.context().newCDPSession(page);
  const x = touchFrom!.x + touchFrom!.width / 2,
    y = touchFrom!.y + touchFrom!.height / 2,
    tx = touchTo!.x + touchTo!.width / 2,
    ty = touchTo!.y + touchTo!.height / 2;
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
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Taşı", exact: true })
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(
    page.locator(`[data-date="${wednesday}"] .day-task`),
  ).toHaveCount(2);
  await expect(page.locator(".task-row")).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator(".week-strip")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  await page.locator(".add-task").click();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(
    await page
      .getByRole("dialog")
      .evaluate((el) => el.getBoundingClientRect().right <= window.innerWidth),
  ).toBeTruthy();
  await page.getByRole("button", { name: "Pencereyi kapat" }).click();
  await page.setViewportSize({ width: 1280, height: 800 });
  expect(errors).toEqual([]);
  await writeFile(
    ".credentials/e2e-cleanup.json",
    JSON.stringify({
      marker,
      monday,
      taskIds: tasks
        .filter((t: TaskRecord) => t.title.startsWith(marker))
        .map((t: TaskRecord) => t.id),
    }),
  );
});
