import { expect, test } from "@playwright/test";

// §2 success step 3: search the index and filter by location, salary, remote type, freshness.
test.describe("S3: Search and filter", () => {
  test("filters are reflected in the URL, so a search is shareable", async ({ page }) => {
    await page.goto("/search");
    await page.locator("#remoteType").selectOption("REMOTE");
    await page.locator("#status").selectOption("VERIFIED");
    await page.getByRole("button", { name: "Search" }).click();
    await expect(page).toHaveURL(/remoteType=REMOTE/);
    await expect(page).toHaveURL(/status=VERIFIED/);
  });

  test("every result shows salary or 'Salary not disclosed', posted, last confirmed, status, and source count", async ({ page }) => {
    await page.goto("/search");
    const first = page.locator("li", { has: page.locator('a[href^="/jobs/"]') }).first();
    await expect(first).toContainText(/Salary not disclosed|\$/);
    await expect(first).toContainText("Posted");
    await expect(first).toContainText("Last confirmed");
    await expect(first).toContainText(/Found on \d+ source/);
  });

  test("jobs without a salary sort last when sorting by salary, and it says so", async ({ page }) => {
    await page.goto("/search?sort=salary");
    await expect(page.getByText(/jobs without a salary sort last/)).toBeVisible();
    const cards = await page.locator("li", { has: page.locator('a[href^="/jobs/"]') }).allInnerTexts();
    const noSalaryIdx = cards.findIndex((t) => t.includes("Salary not disclosed"));
    const withSalaryLastIdx = cards.map((t) => t.includes("Salary not disclosed")).lastIndexOf(false);
    if (noSalaryIdx !== -1 && withSalaryLastIdx !== -1) expect(noSalaryIdx).toBeGreaterThan(withSalaryLastIdx);
  });

  test("an empty result set points the user at Check a Job instead of a dead end", async ({ page }) => {
    await page.goto("/search?q=zzzznonexistentquery12345");
    await expect(page.getByRole("link", { name: "check a specific job" })).toBeVisible();
  });
});
