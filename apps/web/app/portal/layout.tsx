// 고객 화면 (기능 11). 직원 화면과 섞지 않고 따로 둔다 — 고객은 이 아래만 볼 수 있다 (정책서 5.1, proxy.ts 가 막는다).
// 고객 화면은 데스크톱 먼저, 반응형까지 (디자인 설계). 그래서 기기 너비를 따른다.

import type { Viewport } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import PortalNav from "./PortalNav";

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (session.role !== "고객") redirect("/dashboard");

  return (
    <div className="adflow min-h-screen bg-[var(--w-bg-alternative)]">
      <PortalNav />
      <main className="max-w-[960px] mx-auto px-4 md:px-6 py-8 flex flex-col gap-6">{children}</main>
    </div>
  );
}
