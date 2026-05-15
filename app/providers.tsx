"use client";

import { SessionProvider } from "next-auth/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { ToastProvider } from "@shared/ui/Toast";
import { CreativeStateProvider } from "@entities/creative/model";
import { LaunchStateProvider } from "@entities/campaign/model";

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  return (
    <SessionProvider>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <CreativeStateProvider>
            <LaunchStateProvider>{children}</LaunchStateProvider>
          </CreativeStateProvider>
        </ToastProvider>
      </QueryClientProvider>
    </SessionProvider>
  );
}
