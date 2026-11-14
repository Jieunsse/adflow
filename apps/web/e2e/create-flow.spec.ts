import { expect, test } from "@playwright/test";

test("둘러보기에서 광고를 만들고 검수를 요청해요", async ({ page }) => {
  test.setTimeout(30_000);
  const pageErrors: Error[] = [];
  page.on("pageerror", (error) => pageErrors.push(error));

  await page.goto("/login");
  await page.getByRole("button", { name: "로그인 없이 서비스 둘러보기" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto("/create");

  await expect(page.getByRole("heading", { name: /이번 광고가 만들 변화부터 정해요/ })).toBeVisible();
  await page.getByRole("button", { name: "더 많은 사람에게 알리기" }).click();
  await page.getByRole("button", { name: /소재 3안 만들기/ }).click();

  await expect(page.getByText("소재 3안 비교")).toBeVisible({ timeout: 10_000 });
  await page.getByRole("button", { name: "선택한 안으로 진행 →" }).click();

  await expect(page.getByText("이미지 3컷 비교")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByAltText("컨셉 A 이미지")).toBeVisible({ timeout: 10_000 });
  await page.getByRole("radio").first().click();
  await page.getByRole("button", { name: "이 컷으로 다듬기 →" }).click();

  await expect(page.getByText("소재 다듬기")).toBeVisible();
  await page.getByRole("button", { name: "게재 설정으로 →" }).click();

  await expect(page.getByRole("heading", { name: "언제, 얼마나 보여줄까요" })).toBeVisible();
  await page.getByRole("button", { name: "검토하기" }).click();
  await page.getByRole("button", { name: "Meta에 광고 게재하기" }).click();
  await expect(page.getByText("검수를 요청했어요")).toBeVisible();
  expect(pageErrors).toEqual([]);
});
