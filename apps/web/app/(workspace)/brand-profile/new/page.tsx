"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  useBrandProfilesStorage,
} from "@features/brand-profile/model/useBrandProfileStorage";
import { brandProfiles } from "@features/brand-profile/model/brandProfileStore";

export default function NewBrandProfilePage() {
  const router = useRouter();
  const { profiles, saveProfile } = useBrandProfilesStorage();
  const hydrated = brandProfiles.useStore((s) => s.status !== "idle");
  const created = useRef(false);

  useEffect(() => {
    if (!hydrated || created.current) return;
    created.current = true;
    const id = crypto.randomUUID();
    saveProfile({ id, name: "새 프로필", isDefault: profiles.length === 0 });
    router.replace(`/brand-profile/${id}/edit`);
  }, [hydrated, profiles.length, saveProfile, router]);

  return <div className="px-12 py-9 text-[var(--w-fg-neutral)]">불러오는 중…</div>;
}
