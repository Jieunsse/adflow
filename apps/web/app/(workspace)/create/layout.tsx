"use client";

import { CreativeStateProvider } from "@entities/creative/model";
import { LaunchStateProvider } from "@entities/campaign/model";

export default function CreateLayout({ children }: { children: React.ReactNode }) {
  return (
    <CreativeStateProvider>
      <LaunchStateProvider>{children}</LaunchStateProvider>
    </CreativeStateProvider>
  );
}
