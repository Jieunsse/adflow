import type { Viewport } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import WorkspaceNav from "@widgets/sidebar/WorkspaceNav";
import NotificationStreamMount from "@shared/ui/NotificationStreamMount";
import { PageContainer } from "@shared/ui/PageContainer";
import OnboardingGuard from "@widgets/onboarding-guard";

// workspace 전체가 실제 기기 너비를 따르고, 각 화면이 필요한 범위에서만 폭을 제한한다.
export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  return (
    <div className="adflow">
      <OnboardingGuard />
      <NotificationStreamMount />
      <div className="grid grid-cols-1 lg:grid-cols-[248px_minmax(0,1fr)] min-h-screen bg-[var(--w-bg-alternative)]">
        <WorkspaceNav />
        <main className="min-w-0 p-0 lg:p-6">
          <PageContainer>{children}</PageContainer>
        </main>
      </div>
    </div>
  );
}
