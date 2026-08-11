import { expect, test } from "@playwright/test";

type Menu = { label: string; href: string };

const mainMenus: Menu[] = [
  { label: "대시보드", href: "/dashboard" },
  { label: "목표", href: "/goals" },
  { label: "광고 만들기", href: "/create" },
  { label: "브랜드 프로필", href: "/brand-profile" },
];

const collapsibleMenus = [
  {
    label: "캠페인 관리",
    children: [
      { label: "캠페인", href: "/campaigns" },
      { label: "A/B 테스트", href: "/ab-tests" },
      { label: "승인 대기", href: "/approvals" },
      { label: "소재 라이브러리", href: "/library" },
    ],
  },
  {
    label: "크리에이터",
    children: [
      { label: "크리에이터", href: "/creators" },
      { label: "협업 캠페인", href: "/creators/campaigns" },
      { label: "파트너십 콘텐츠", href: "/instagram/partnerships" },
    ],
  },
  {
    label: "Instagram",
    children: [
      { label: "인사이트", href: "/instagram" },
      { label: "콘텐츠", href: "/instagram/posts" },
      { label: "DM", href: "/instagram/messages" },
    ],
  },
  {
    label: "Facebook",
    children: [
      { label: "인사이트", href: "/facebook" },
      { label: "게시물", href: "/facebook/posts" },
    ],
  },
  {
    label: "워크스페이스",
    children: [
      { label: "구성원 · 권한", href: "/members" },
      { label: "계정 연결", href: "/connect" },
      { label: "청구 및 결제", href: "/billing" },
      { label: "설정", href: "/settings" },
    ],
  },
];

test("둘러보기 모드의 사이드바 메뉴가 모두 화면을 열어요", async ({ page }) => {
  const pageErrors: Error[] = [];
  page.on("pageerror", (error) => pageErrors.push(error));

  await page.goto("/login");
  await page.getByRole("button", { name: "로그인 없이 서비스 둘러보기" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  const sidebar = page.locator("aside");
  const menuNav = sidebar.locator("nav");
  const visit = async ({ label, href }: Menu) => {
    await test.step(`${label} (${href})`, async () => {
      const link = menuNav.locator(`a[href="${href}"]`);
      await expect.soft(link).toContainText(label);
      if (!(await link.isVisible())) return;

      await link.click();
      await expect.soft(page).toHaveURL(new RegExp(`${href.replaceAll("/", "\\/")}$`));
      await expect.soft(page.locator("main")).toBeVisible();
    });
  };

  for (const menu of mainMenus) await visit(menu);

  for (const group of collapsibleMenus) {
    const toggle = menuNav.getByRole("button", { name: group.label, exact: true });
    const firstChild = menuNav.locator(`a[href="${group.children[0].href}"]`);
    await expect.soft(toggle).toBeVisible();
    if (!(await firstChild.isVisible())) await toggle.click();
    await expect.soft(firstChild).toBeVisible();
    for (const menu of group.children) await visit(menu);
  }

  expect(pageErrors).toEqual([]);
});
