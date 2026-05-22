import type { Viewport } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import Sidebar from "@widgets/sidebar";
import NotificationStreamMount from "@shared/ui/NotificationStreamMount";

// The design is desktop-only (1440px frame), matching the design bundle's <meta viewport>.
export const viewport: Viewport = { width: 1440 };

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  return (
    <div className="adflow">
      <NotificationStreamMount />
      <div className="grid grid-cols-[248px_1fr] min-h-screen bg-[var(--w-bg-alternative)]">
        <Sidebar />
        <main className="min-w-0">{children}</main>
      </div>
    </div>
  );
}
