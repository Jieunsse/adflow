import { expect, test } from "@playwright/test";

test("비로그인 사용자는 로그인 화면으로 이동해요", async ({ page }) => {
  await page.goto("/dashboard");

  await expect(page).toHaveURL(/\/login\?callbackUrl=%2Fdashboard/);
  await expect(page.getByRole("button", { name: "Facebook으로 로그인" })).toBeVisible();
});

test("둘러보기 사용자는 로그인 후 바로 대시보드를 이용해요", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "로그인 없이 서비스 둘러보기" }).click();

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.locator('[data-screen-label="대시보드"]')).toBeVisible();
});

test("Facebook 로그인은 필요한 권한을 포함한 Meta 승인 화면으로 이동해요", async ({ page }) => {
  await page.route("https://www.facebook.com/**", (route) =>
    route.fulfill({ status: 200, body: "Facebook authorization intercepted" }),
  );
  await page.goto("/login");

  const [authorization] = await Promise.all([
    page.waitForRequest((request) =>
      request.url().startsWith("https://www.facebook.com/v20.0/dialog/oauth"),
    ),
    page.getByRole("button", { name: "Facebook으로 로그인" }).click(),
  ]);
  const url = new URL(authorization.url());
  const scopes = new Set(url.searchParams.get("scope")?.split(","));
  const expectedOrigin = new URL(page.url()).origin;

  expect(url.searchParams.get("response_type")).toBe("code");
  expect(url.searchParams.get("redirect_uri")).toBe(
    `${expectedOrigin}/api/auth/callback/facebook`,
  );
  for (const scope of [
    "ads_management",
    "ads_read",
    "pages_show_list",
    "pages_read_engagement",
    "business_management",
    "instagram_basic",
    "instagram_manage_insights",
  ]) {
    expect(scopes.has(scope)).toBe(true);
  }
});
