import { expect, test } from "@playwright/test";

test("둘러보기 분석 필터와 CSV 내보내기가 동작해요", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "로그인 없이 서비스 둘러보기" }).click();
  await page.waitForURL("**/dashboard");
  await page.goto("/analysis");

  await page.getByLabel("분석 기간").selectOption("7d");
  await page.getByLabel("게재위치").selectOption("instagram");
  await expect(page.getByLabel("게재위치")).toHaveValue("instagram");
  expect(await page.locator("table").first().locator("tbody tr").count()).toBeGreaterThan(0);

  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "내보내기" }).click();
  await expect((await download).suggestedFilename()).toMatch(/^광고성과_.*\.csv$/);
});
