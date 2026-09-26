import { expect, test } from "@playwright/test";

// Each test simulates a distinct visitor: Check a Job is IP rate-limited, and
// this suite's requests would otherwise collapse onto one shared "unknown" IP
// in a dev environment with no real X-Forwarded-For, queuing behind each
// other exactly as the limiter is supposed to when requests share an IP.
test.beforeEach(async ({ page }, testInfo) => {
  let hash = 0;
  for (const c of testInfo.testId) hash = (hash * 31 + c.charCodeAt(0)) % 250;
  await page.setExtraHTTPHeaders({ "x-forwarded-for": `203.0.113.${hash + 1}` });
});

// §2 success step 1: paste a URL or text, get a Job Passport.
test.describe("S1: Check a job", () => {
  test("a real posting comes back Verified with the employer's own apply link", async ({ page }) => {
    await page.goto("/check");
    await page.getByLabel("Paste text").check();
    await page.locator("textarea").fill(
      ["Job Title: Electrical Technologist", "Company: Northwind Labs", "Location: Edmonton, AB", "Compensation: $72,000–$90,000 per year."].join("\n"),
    );
    await page.getByLabel(/Employer name/).fill("Northwind Labs");
    await page.getByRole("button", { name: "Check this job" }).click();
    const passport = page.locator("section", { has: page.getByText("JOB PASSPORT") });
    await expect(passport).toBeVisible({ timeout: 15_000 });
    await expect(passport.getByText("Verified", { exact: false })).toBeVisible();
    const applyLink = page.getByRole("link", { name: "Apply through the employer's site here" });
    await expect(applyLink).toBeVisible();
    await expect(applyLink).toHaveAttribute("href", /northwindlabs\.example/);
  });

  test("a scam message quoting a real employer is flagged, without inheriting that employer's trust", async ({ page }) => {
    await page.goto("/check");
    await page.getByLabel("Paste text").check();
    await page.locator("textarea").fill(
      [
        "Northwind Labs is hiring Remote Data Entry Clerks, $35/hr, no experience needed.",
        "Message our hiring manager on WhatsApp at +1 555 0100 to schedule your interview.",
        "You must purchase a starter kit ($250) before training begins.",
      ].join("\n"),
    );
    await page.getByLabel(/Employer name/).fill("Northwind Labs");
    await page.getByRole("button", { name: "Check this job" }).click();
    const passport = page.locator("section", { has: page.getByText("JOB PASSPORT") });
    await expect(passport.getByText("High risk", { exact: false })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("We couldn't find this on the employer's site")).toBeVisible();
    await expect(page.getByText("Asks for money up front")).toBeVisible();
    await expect(page.getByText("Moves the conversation off-platform")).toBeVisible();
  });

  test("never fetches a disallowed site and says why, instead of silently failing", async ({ page }) => {
    await page.goto("/check");
    await page.locator('input[type="url"]').fill("https://www.linkedin.com/jobs/view/12345");
    await page.getByRole("button", { name: "Check this job" }).click();
    await expect(page.getByText(/linkedin/i)).toBeVisible({ timeout: 15_000 });
  });

  test("asks for input rather than silently doing nothing", async ({ page }) => {
    await page.goto("/check");
    await page.getByLabel("Paste text").check();
    // Required attribute blocks empty submit client-side — fill whitespace to exercise the server path.
    await page.locator("textarea").fill("   ");
    await page.getByRole("button", { name: "Check this job" }).click();
    await expect(page.getByRole("alert").filter({ hasText: /./ })).toBeVisible({ timeout: 15_000 });
  });
});
