"use client";

import { SessionProvider } from "next-auth/react";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { ToastProvider } from "@shared/ui/Toast";
import { useTheme } from "@shared/lib/useTheme";

function ThemeSync() {
  useTheme();
  return null;
}

function QuerySessionBoundary() {
  const { data: session, status } = useSession();
  const queryClient = useQueryClient();
  const previousScope = useRef<string | undefined>(undefined);
  const scope = status === "loading"
    ? null
    : [
        session?.user?.email ?? "anonymous",
        session?.adAccountId ?? "-",
        session?.pageId ?? "-",
        session?.browseMode ? "browse" : "live",
      ].join(":");

  useEffect(() => {
    if (scope === null) return;
    if (previousScope.current !== undefined && previousScope.current !== scope) {
      queryClient.clear();
    }
    previousScope.current = scope;
  }, [queryClient, scope]);

  return null;
}

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  return (
    <SessionProvider>
      <QueryClientProvider client={queryClient}>
        <QuerySessionBoundary />
        <ThemeSync />
        <ToastProvider>{children}</ToastProvider>
      </QueryClientProvider>
    </SessionProvider>
  );
}
