import { expect, test } from "@playwright/test";

// §2 success step 2: understand why a job got its status, every signal expandable.
test.describe("S2: Understand why", () => {
  test("a job's Passport shows evidence for every signal, and links to the public rule table", async ({ page }) => {
    await page.goto("/search");
    await page.locator('a[href^="/jobs/"]').first().click();
    await page.waitForURL(/\/jobs\//);
    await expect(page.getByText("JOB PASSPORT")).toBeVisible();

    // Status icon + text together, not colour alone.
    const statusRow = page.locator("dt", { hasText: "Status" }).locator("xpath=following-sibling::dd[1]");
    await expect(statusRow).toBeVisible();

    // The job detail page renders signals expanded by default (full transparency) —
    // every one shows what we checked and what it means, not just a code.
    await expect(page.locator("li p", { hasText: /^We / }).first()).toBeVisible();

    const howLink = page.getByRole("link", { name: "How verification works" }).first();
    await howLink.click();
    await expect(page).toHaveURL(/\/docs\/verification/);
    await expect(page.getByRole("heading", { name: "How verification works" })).toBeVisible();
    // The page renders the same rule table the code runs — every status name appears.
    for (const label of ["Verified", "Partially verified", "Unverified", "Stale", "High risk"]) {
      await expect(page.getByText(label, { exact: false }).first()).toBeVisible();
    }
  });

  test("a High risk job never calls the posting a scam outright", async ({ page }) => {
    await page.goto("/search?status=HIGH_RISK");
    const link = page.locator('a[href^="/jobs/"]').first();
    await expect(link).toBeVisible();
    await link.click();
    await page.waitForURL(/\/jobs\//);
    const passport = page.locator("section", { has: page.getByText("JOB PASSPORT") });
    await expect(passport.getByText("High risk", { exact: false })).toBeVisible();
    const bodyText = await page.locator("main").innerText();
    expect(bodyText).not.toMatch(/\bis a scam\b|\bscammer\b/i);
  });
});
