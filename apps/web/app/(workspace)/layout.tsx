import type { Viewport } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import WorkspaceNav from "@widgets/sidebar/WorkspaceNav";
import NotificationStreamMount from "@shared/ui/NotificationStreamMount";
import OnboardingGuard from "@widgets/onboarding-guard";

// 기본은 데스크톱 전용(1440px 프레임) — 디자인 번들의 <meta viewport> 와 같다.
// 모바일까지 그린 화면(목표 등)은 자기 page.tsx 에서 device-width 로 덮어쓴다.
export const viewport: Viewport = { width: 1440 };

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  return (
    <div className="adflow">
      <OnboardingGuard />
      <NotificationStreamMount />
      <div className="grid grid-cols-1 lg:grid-cols-[248px_1fr] min-h-screen bg-[var(--w-bg-alternative)]">
        <WorkspaceNav />
        <main className="min-w-0">{children}</main>
      </div>
    </div>
  );
}
