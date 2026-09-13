"use client";

// ADR-038 — A/B 토너먼트 셋업 진입. 데모(browseMode)·실 유저 모두 TournamentSetup 으로 통일.
// 레거시 단판 A/B 위저드는 ADR-038 "토너먼트 전면 교체"로 폐기 — 토너먼트가 단일 A/B 채널.
// 데이터 소스만 갈린다: 데모=localStorage 시뮬, 실=POST /api/tournaments(Supabase + Meta adstudy).

import { useSession } from "next-auth/react";
import TournamentSetup from "@widgets/tournament-setup";

export default function AbTestNewPage() {
  const { data: session } = useSession();
  return <TournamentSetup real={!session?.browseMode} />;
}
