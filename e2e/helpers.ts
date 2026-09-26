import type { Page } from "@playwright/test";

export async function signUp(page: Page, email = `e2e${Date.now()}${Math.floor(Math.random() * 1e6)}@example.com`) {
  await page.goto("/sign-up", { waitUntil: "networkidle" });
  await page.getByLabel("Email").fill(email);
  await page.getByLabel(/Password/).fill("correct horse battery staple");
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL("**/", { timeout: 10_000 });
  return email;
}
