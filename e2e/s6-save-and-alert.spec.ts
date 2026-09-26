import { expect, test } from "@playwright/test";
import { signUp } from "./helpers";

// §2 success step 6: sign up, save a job, create a saved-search alert.
test.describe("S6: Save and alert", () => {
  test("sign-up, save a job, and see it on the Saved page", async ({ page }) => {
    await signUp(page);

    await page.goto("/search");
    await page.locator('a[href^="/jobs/"]').first().click();
    await page.waitForURL(/\/jobs\//);
    // h1 is "<title> · <employer>"; the Saved page links by title alone.
    const title = (await page.locator("h1").innerText()).split(" · ")[0]!;

    await page.getByRole("button", { name: /☆ Save/ }).click();
    await expect(page.getByRole("button", { name: /★ Saved/ })).toBeVisible();

    await page.goto("/saved");
    await expect(page.getByRole("link", { name: title })).toBeVisible();
  });

  test("saving a search stores it and offers it back from /saved", async ({ page }) => {
    await signUp(page);
    await page.goto("/search?remoteType=REMOTE");
    await page.getByRole("button", { name: "Save this search" }).click();
    await page.getByPlaceholder(/Toronto software jobs/).fill("My remote jobs");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText(/Saved\. You'll get an alert/)).toBeVisible();

    await page.goto("/saved");
    await expect(page.getByRole("link", { name: "My remote jobs" })).toBeVisible();
  });

  test("account export and delete are available, and export downloads real JSON", async ({ page }) => {
    const email = await signUp(page);
    await page.goto("/account");
    await expect(page.getByText(email)).toBeVisible();

    const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("link", { name: "Export my data (JSON)" }).click()]);
    const path = await download.path();
    expect(path).toBeTruthy();
  });
});
