import { expect, test } from "@playwright/test";

// §2 success step 5: click Apply at original source and land on the employer's real page.
test.describe("S5: Apply at the source", () => {
  test("Apply at original source is the primary CTA, always visible, opens the canonical employer URL safely", async ({ page }) => {
    await page.goto("/search");
    await page.locator('a[href^="/jobs/"]').first().click();

    const apply = page.getByRole("link", { name: "Apply at original source" });
    await expect(apply).toBeVisible();
    await expect(apply).toHaveAttribute("target", "_blank");
    await expect(apply).toHaveAttribute("rel", /noopener/);
    const href = await apply.getAttribute("href");
    expect(href).toMatch(/^https?:\/\//);
  });

  test("clicking Apply doesn't navigate away from the Passport (opens in a new tab)", async ({ page, context }) => {
    await page.goto("/search");
    await page.locator('a[href^="/jobs/"]').first().click();
    const [popup] = await Promise.all([context.waitForEvent("page"), page.getByRole("link", { name: "Apply at original source" }).click()]);
    await popup.close();
    await expect(page.getByText("JOB PASSPORT")).toBeVisible();
  });
});
