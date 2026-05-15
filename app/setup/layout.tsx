import type { Viewport } from "next";

export const viewport: Viewport = { width: 1440 };

export default function SetupLayout({ children }: { children: React.ReactNode }) {
  return children;
}
