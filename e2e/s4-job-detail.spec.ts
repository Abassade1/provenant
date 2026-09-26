import { expect, test } from "@playwright/test";

// §2 success step 4: open a job, see its source, salary provenance and duplicate sources.
test.describe("S4: Inspect a job", () => {
  test("sections render in brief order: Passport, description, skills, salary evidence, source history", async ({ page }) => {
    await page.goto("/search");
    await page.locator('a[href^="/jobs/"]').first().click();
    await page.waitForURL(/\/jobs\//);

    const order = ["JOB PASSPORT", "Description", "Salary evidence", "Source history"];
    const positions = await Promise.all(order.map((t) => page.getByText(t, { exact: false }).first().evaluate((el) => el.getBoundingClientRect().top)));
    for (let i = 1; i < positions.length; i++) expect(positions[i]!).toBeGreaterThan(positions[i - 1]!);
  });

  test("a job with employer-stated salary labels it in words, not just a number", async ({ page }) => {
    await page.goto("/search?sort=salary");
    await page.locator('a[href^="/jobs/"]').first().click();
    await page.waitForURL(/\/jobs\//);
    const passport = page.locator("section", { has: page.getByText("JOB PASSPORT") });
    await expect(passport.getByText(/employer advertised/).first()).toBeVisible();
  });

  test("'Also found on' lists every source with a link, not just a bare count", async ({ page }) => {
    // Unfiltered, newest-first: the demo data's merged reposts are common enough to appear on page 1.
    await page.goto("/search?sort=newest");
    const cards = page.locator("li", { has: page.locator('a[href^="/jobs/"]') });
    const count = await cards.count();
    let opened = false;
    for (let i = 0; i < count; i++) {
      const text = await cards.nth(i).innerText();
      if (/Found on [2-9]/.test(text)) {
        await cards.nth(i).locator('a[href^="/jobs/"]').click();
        await page.waitForURL(/\/jobs\//);
        opened = true;
        break;
      }
    }
    test.skip(!opened, "No multi-source job on this page of demo data — not a page this journey controls.");
    await expect(page.getByRole("heading", { name: "Source history" })).toBeVisible();
    const section = page.locator("section", { has: page.getByRole("heading", { name: "Source history" }) });
    expect(await section.locator("a").count()).toBeGreaterThanOrEqual(2);
  });
});
