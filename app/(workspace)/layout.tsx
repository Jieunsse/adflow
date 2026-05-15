import type { Viewport } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import Sidebar from "@widgets/sidebar";

// The design is desktop-only (1440px frame), matching the design bundle's <meta viewport>.
export const viewport: Viewport = { width: 1440 };

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  return (
    <div className="adflow">
      <div className="shell">
        <Sidebar />
        <main className="main">{children}</main>
      </div>
    </div>
  );
}
