import type { Viewport } from "next";

export const viewport: Viewport = { width: 1440 };

export default function InstallLayout({ children }: { children: React.ReactNode }) {
  return children;
}
