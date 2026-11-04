import { test, expect } from "@playwright/test";
test("records persist and drive dashboard, recurring transactions and CSV", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Your financial overview." }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Add transaction", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Description").fill("Monthly salary");
  await dialog.getByLabel("Amount").fill("10000");
  await dialog.getByLabel("Type", { exact: true }).selectOption("income");
  await dialog.getByLabel("Category").selectOption("Salary");
  await dialog.getByLabel("Repeat every month").check();
  await dialog.getByRole("button", { name: "Save", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.locator(".stat-card").first()).toContainText("10,000");
  await page.reload();
  await expect(page.locator(".stat-card").first()).toContainText("10,000");
  await page
    .getByRole("button", { name: "Add transaction", exact: true })
    .click();
  await dialog.getByLabel("Description").fill("Groceries");
  await dialog.getByLabel("Amount").fill("250");
  await dialog.getByLabel("Category").selectOption("Groceries");
  await dialog.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.locator(".stat-card").nth(2)).toContainText("9,750");
  await page.getByRole("button", { name: "Transactions", exact: true }).click();
  await page.getByPlaceholder("Search transactions…").fill("Groceries");
  await expect(page.locator(".transaction-row")).toHaveCount(1);
  const dl = page.waitForEvent("download");
  await page.getByRole("button", { name: "CSV", exact: true }).click();
  expect((await dl).suggestedFilename()).toContain(".csv");
  expect(errors).toEqual([]);
});
test("overnight shift and contribution update real calculated totals", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Work & salary", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Add workplace", exact: true })
    .click();
  const d = page.getByRole("dialog");
  await d.getByLabel("Name", { exact: true }).fill("Cafe");
  await d.getByLabel("Hourly wage (gross)").fill("50");
  await d.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByRole("button", { name: "Log shift", exact: true }).click();
  await d
    .getByLabel("Start (local time)")
    .fill(
      `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}-01T20:00`,
    );
  await d
    .getByLabel("End (use next date for overnight shifts)")
    .fill(
      `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}-02T07:00`,
    );
  await d.getByLabel("Break minutes").fill("60");
  await d.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.locator("tbody")).toContainText("525");
  await expect(page.locator("tbody")).toContainText("10.00");
  await page
    .getByRole("button", { name: "Savings goals", exact: true })
    .click();
  await page.getByRole("button", { name: "New goal", exact: true }).click();
  await d.getByLabel("Name", { exact: true }).fill("First adventure");
  await d.getByLabel("Target amount").fill("10000");
  await d.getByLabel("Existing savings").fill("1000");
  await d.getByLabel("Planned monthly contribution").fill("500");
  await d.getByLabel("Target date").fill("2027-12-01");
  await d.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByRole("button", { name: "Contribute", exact: true }).click();
  await d.getByLabel("Amount").fill("500");
  await d.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.locator(".goal-values")).toContainText("1,500");
  await expect(page.locator(".goal-card .pill")).toHaveText("15%");
});
test("mobile layout, Hebrew RTL, theme and unavailable AI", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.locator("h1")).toContainText("Your financial overview");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Change language" }).click();
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.locator("h1")).toContainText("התמונה הכלכלית שלך");
  await page.getByRole("button", { name: "Toggle theme" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.locator("aside")).not.toBeVisible();
  await page.screenshot({
    path: "/tmp/savio-mobile-hebrew.png",
    animations: "disabled",
    fullPage: true,
  });
});
test("sensitive APIs reject cross-origin writes", async ({ request }) => {
  for (const path of ["/api/ai", "/api/account", "/api/data"]) {
    const response = await request.fetch(path, {
      method: path.endsWith("account")
        ? "DELETE"
        : path.endsWith("data")
          ? "PUT"
          : "POST",
      headers: { origin: "https://untrusted.example" },
      data: {},
    });
    expect(response.status()).toBe(403);
  }
});

test("edit/delete, budgets, timer and local insight remain functional", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Add transaction", exact: true })
    .click();
  const d = page.getByRole("dialog");
  await d.getByLabel("Description").fill("Lunch");
  await d.getByLabel("Amount").fill("40");
  await d.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByRole("button", { name: "Transactions", exact: true }).click();
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await d.getByLabel("Amount").fill("60");
  await d.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.locator(".transaction-amount")).toContainText("60");
  await page.getByRole("button", { name: "Budgets", exact: true }).click();
  const budget = page.locator(".budgets-grid .panel").first();
  await budget.getByRole("spinbutton").fill("500");
  await budget.getByRole("button", { name: "Save", exact: true }).click();
  await expect(budget.locator(".goal-values")).toContainText("500");
  await page
    .getByRole("button", { name: "Work & salary", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Add workplace", exact: true })
    .click();
  await d.getByLabel("Name", { exact: true }).fill("Store");
  await d.getByLabel("Hourly wage (gross)").fill("45");
  await d.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await expect(page.locator(".timer")).toBeVisible();
  await page.waitForTimeout(1100);
  await page.getByRole("button", { name: "Stop shift", exact: true }).click();
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await page.getByRole("button", { name: "SAVIO AI AI", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Local insights", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Send message", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Transactions", exact: true }).click();
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page.locator(".transaction-row")).toHaveCount(0);
  await page.getByRole("button", { name: "Overview", exact: true }).click();
  await page.screenshot({ path: "/tmp/savio-desktop.png", fullPage: true });
});

test("calendar reminders support create, edit, completion, deletion and mobile navigation", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Calendar", exact: true }).click();
  await expect(page).toHaveURL(/tab=calendar/);
  await page.getByRole("button", { name: "New reminder", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toHaveAccessibleName("New reminder");
  await dialog.getByLabel("Reminder title").fill("Pay rent");
  await dialog
    .getByRole("button", { name: "Save reminder", exact: true })
    .click();
  await expect(page.locator(".workplace")).toContainText("Pay rent");
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Your financial calendar" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Edit reminder", exact: true })
    .click();
  await dialog.getByLabel("Reminder title").fill("Pay rent on time");
  await dialog
    .getByRole("button", { name: "Save reminder", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Mark reminder complete", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Mark reminder incomplete", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  page.once("dialog", (d) => d.accept());
  await page
    .getByRole("button", { name: "Delete reminder", exact: true })
    .click();
  await expect(page.locator(".workplace")).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  await expect(page.locator("aside")).toBeVisible();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(page.locator("aside")).not.toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Your preferences" }),
  ).toBeVisible();
});
test("auth pages offer bilingual, explicit unavailable states and working navigation", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/login");
  await expect(
    page.getByRole("heading", { name: "Welcome back." }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Sign in", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Change language", exact: true })
    .click();
  await expect(page.locator("main")).toHaveAttribute("dir", "rtl");
  await page.getByRole("link", { name: "יצירת חשבון", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Your future starts here." }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Forgot password?", exact: true })
    .click();
  await expect(page).toHaveURL(/auth\/reset/);
  await expect(
    page.getByRole("button", { name: "Send reset link", exact: true }),
  ).toBeDisabled();
  expect(errors).toEqual([]);
});
test("invalid local data is preserved with export and recovery controls", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("h1")).toContainText("Your financial overview");
  await page.evaluate(() =>
    localStorage.setItem("savio-local-v1", '{"broken":true}'),
  );
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Retry loading" }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => localStorage.getItem("savio-local-v1")),
  ).toBe('{"broken":true}');
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export browser backup" }).click();
  expect((await download).suggestedFilename()).toBe(
    "savio-browser-backup.json",
  );
});
test("stale local tabs cannot overwrite newer records", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await expect(page.locator("h1")).toContainText("Your financial overview");
  const other = await context.newPage();
  await other.goto("/");
  await expect(other.locator("h1")).toContainText("Your financial overview");
  await page
    .getByRole("button", { name: "Add transaction", exact: true })
    .click();
  const first = page.getByRole("dialog");
  await first.getByLabel("Description").fill("First tab");
  await first.getByLabel("Amount").fill("100");
  await first.getByRole("button", { name: "Save", exact: true }).click();
  await other
    .getByRole("button", { name: "Add transaction", exact: true })
    .click();
  const second = other.getByRole("dialog");
  await second.getByLabel("Description").fill("Stale tab");
  await second.getByLabel("Amount").fill("50");
  await second.getByRole("button", { name: "Save", exact: true }).click();
  await expect(second.getByRole("alert")).toContainText("another tab");
  const stored = await page.evaluate(
    () => JSON.parse(localStorage.getItem("savio-local-v1")!).transactions,
  );
  expect(stored).toHaveLength(1);
  expect(stored[0].title).toBe("First tab");
  await other.close();
});
test("unconfigured cloud routes fail explicitly and public PWA assets load", async ({
  request,
}) => {
  for (const path of ["/api/data", "/api/import"]) {
    const res = await request.get(path);
    expect(res.status()).toBe(503);
    expect((await res.json()).error).toContain("not configured");
  }
  const availability = await request.get("/api/ai");
  expect((await availability.json()).available).toBe(false);
  const manifest = await request.get("/manifest.webmanifest");
  expect(manifest.ok()).toBe(true);
  expect((await manifest.json()).name).toContain("SAVIO");
  expect((await request.get("/offline.html")).ok()).toBe(true);
});

test("savings goals can remain undated and still be edited", async ({
  page,
}) => {
  await page.goto("/?tab=goals");
  await page.getByRole("button", { name: "New goal", exact: true }).click();
  const d = page.getByRole("dialog");
  await d.getByLabel("Name", { exact: true }).fill("Emergency fund");
  await d.getByLabel("Target amount").fill("10000");
  await d.getByLabel("Planned monthly contribution").fill("500");
  await d.getByRole("button", { name: "Save", exact: true }).click();
  await expect(d).not.toBeVisible();
  await expect(page.locator(".goal-card")).toContainText("No target date");
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await d.getByLabel("Planned monthly contribution").fill("600");
  await d.getByRole("button", { name: "Save", exact: true }).click();
  await expect(d).not.toBeVisible();
  await expect(page.locator(".goal-card")).toContainText("600");
});
